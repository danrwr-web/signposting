import 'server-only'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { EditorialGenerateRequestZ, type EditorialRole } from '@/lib/schemas/editorial'
import { EditorialAiError, buildEditorialPrompts } from '@/server/editorialAi'
import { inferRiskLevel, resolveNeedsSourcing } from '@/lib/editorial/guards'
import { resolveTargetRole } from '@/lib/editorial/roleRouting'
import { inferLearningCategories, type LearningCategoryRef } from '@/lib/editorial/inferLearningCategory'
import { validateAdminCards } from '@/lib/editorial/adminValidator'
import { parseAndValidateGeneration } from '@/lib/editorial/generationParsing'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const DEFAULT_TEMPERATURE = 0.2
const MAX_GENERATIONS_PER_HOUR = 5

function sseEvent(type: string, data: unknown): string {
  return `data: ${JSON.stringify({ type, ...( typeof data === 'object' && data !== null ? data : { payload: data }) })}\n\n`
}

function normaliseTagKey(t: string): string {
  return t.toLowerCase().replace(/[''`]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function buildTagNormMap(tagNames: string[]): Map<string, string> {
  return new Map(tagNames.map((n) => [normaliseTagKey(n), n]))
}

function resolveCardTags(aiTags: unknown[], tagNormMap: Map<string, string>): string[] {
  return (Array.isArray(aiTags) ? aiTags : [])
    .map((t): string | null => {
      if (typeof t !== 'string') return null
      return tagNormMap.get(normaliseTagKey(t.trim())) ?? null
    })
    .filter((t): t is string => t !== null)
}

function matchCategoryByName(
  promptText: string,
  categories: Array<{ id: string; name: string; slug: string; subsections: string[] }>,
): { id: string; name: string } | null {
  const promptLower = promptText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
  const promptTokens = promptLower.split(/\s+/).filter((t) => t.length >= 3)
  if (promptTokens.length === 0) return null
  let best: { id: string; name: string } | null = null
  let bestScore = 0
  for (const cat of categories) {
    const nameTokens = cat.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length >= 3)
    let score = 0
    for (const pt of promptTokens) {
      if (nameTokens.includes(pt)) score += 3
      else if (cat.name.toLowerCase().includes(pt)) score += 1
    }
    if (score > bestScore) { bestScore = score; best = { id: cat.id, name: cat.name } }
  }
  return bestScore >= 2 ? best : null
}

async function ensureEditorialTopic(surgeryId: string, role: EditorialRole): Promise<string> {
  const name = 'Daily Dose Editorial'
  const existing = await prisma.dailyDoseTopic.findFirst({
    where: { surgeryId, name },
    select: { id: true, roleScope: true },
  })
  if (existing) {
    const roleScope = Array.isArray(existing.roleScope) ? existing.roleScope : []
    if (!roleScope.includes(role)) {
      await prisma.dailyDoseTopic.update({
        where: { id: existing.id },
        data: { roleScope: [...new Set([...roleScope, role])] },
      })
    }
    return existing.id
  }
  const created = await prisma.dailyDoseTopic.create({
    data: { surgeryId, name, roleScope: [role], ordering: 0, isActive: true },
  })
  return created.id
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  const requestId = randomUUID()

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (type: string, data: unknown = {}) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(type, data)))
        } catch {
          // controller may already be closed
        }
      }

      try {
        // --- Auth ---
        const user = await getSessionUser()
        if (!user) {
          emit('error', { code: 'UNAUTHENTICATED', message: 'Authentication required' })
          controller.close()
          return
        }

        const body = await request.json()
        const parsed = EditorialGenerateRequestZ.parse(body)
        const surgeryId = resolveSurgeryIdForUser({ requestedId: parsed.surgeryId, user })
        if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
          emit('error', { code: 'FORBIDDEN', message: 'Admin access required' })
          controller.close()
          return
        }

        const isSuperuser = user.globalRole === 'SUPERUSER'

        // --- Rate limit ---
        const since = new Date(Date.now() - 60 * 60 * 1000)
        const recentCount = await prisma.dailyDoseGenerationBatch.count({
          where: { createdBy: user.id, createdAt: { gte: since } },
        })
        if (recentCount >= MAX_GENERATIONS_PER_HOUR) {
          emit('error', { code: 'RATE_LIMITED', message: 'Generation limit reached. Try again later.' })
          controller.close()
          return
        }

        const resolvedRole = resolveTargetRole({ promptText: parsed.promptText, requestedRole: parsed.targetRole })

        emit('status', { stage: 'preparing', message: 'Preparing prompts…' })

        // --- Parallel pre-generation DB fetches ---
        const [availableTags, learningCategories, existingPublishedCards] = await Promise.all([
          prisma.dailyDoseTag.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
          prisma.learningCategory.findMany({
            where: { isActive: true },
            select: { id: true, name: true, slug: true, subsections: true },
            orderBy: { ordering: 'asc' },
          }),
          prisma.dailyDoseCard.findMany({
            where: { surgeryId, targetRole: resolvedRole, status: 'PUBLISHED' },
            select: { title: true, learningAssignments: true },
            orderBy: { publishedAt: 'desc' },
            take: 100,
          }),
        ])

        const availableTagNames = availableTags.map((t) => t.name)
        const categoryRefs: LearningCategoryRef[] = learningCategories.map((c) => ({
          id: c.id, name: c.name, slug: c.slug,
          subsections: Array.isArray(c.subsections) ? (c.subsections as string[]) : [],
        }))

        let inferredCategories = inferLearningCategories(parsed.promptText, categoryRefs)
        if (inferredCategories.length === 0 && categoryRefs.length > 0) {
          const catMatch = matchCategoryByName(parsed.promptText, categoryRefs)
          if (catMatch) {
            inferredCategories = [{ categoryId: catMatch.id, categoryName: catMatch.name, subsection: '', confidence: 'low' }]
          }
        }

        const inferredCategoryIds = inferredCategories.map((c) => c.categoryId)
        const matchingCards = inferredCategoryIds.length > 0
          ? existingPublishedCards.filter((c) => {
              const assignments = Array.isArray(c.learningAssignments) ? c.learningAssignments as Array<{ categoryId: string }> : []
              return assignments.some((a) => inferredCategoryIds.includes(a.categoryId))
            })
          : existingPublishedCards
        const existingTitles = (matchingCards.length > 0 ? matchingCards : existingPublishedCards).slice(0, 50).map((c) => c.title)

        // Build prompts
        const built = await buildEditorialPrompts({
          surgeryId,
          promptText: parsed.promptText,
          targetRole: resolvedRole,
          count: parsed.count,
          interactiveFirst: parsed.interactiveFirst ?? true,
          availableTagNames: availableTagNames.length > 0 ? availableTagNames : undefined,
          existingTitles: existingTitles.length > 0 ? existingTitles : undefined,
        })

        const systemPrompt = (isSuperuser && parsed.systemPromptOverride) ? parsed.systemPromptOverride : built.systemPrompt
        const userPrompt = (isSuperuser && parsed.userPromptOverride) ? parsed.userPromptOverride : built.userPrompt

        emit('status', { stage: 'generating', message: 'AI is writing cards…' })

        // --- Streaming Azure OpenAI call ---
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT
        const apiKey = process.env.AZURE_OPENAI_API_KEY
        const deployment = process.env.AZURE_OPENAI_DEPLOYMENT
        const apiVersion = process.env.AZURE_OPENAI_API_VERSION

        if (!endpoint || !apiKey || !deployment || !apiVersion) {
          throw new EditorialAiError('CONFIG_MISSING', 'Missing Azure OpenAI configuration')
        }

        const apiUrl = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`
        const abortController = new AbortController()
        const timeoutId = setTimeout(() => abortController.abort(), 240000)

        const aiResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
          body: JSON.stringify({
            temperature: DEFAULT_TEMPERATURE,
            stream: true,
            messages: [
              { role: 'system', content: systemPrompt.trim() },
              { role: 'user', content: userPrompt.trim() },
            ],
          }),
          signal: abortController.signal,
        })
        clearTimeout(timeoutId)

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text()
          throw new EditorialAiError('LLM_FAILED', `AI request failed: ${aiResponse.status}`, errorText)
        }

        if (!aiResponse.body) {
          throw new EditorialAiError('LLM_EMPTY', 'AI returned empty stream')
        }

        // Collect the full streamed output while emitting progress ticks
        let fullContent = ''
        let tokenCount = 0
        const reader = aiResponse.body.getReader()
        const textDecoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = textDecoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              const delta = parsed?.choices?.[0]?.delta?.content
              if (delta) {
                fullContent += delta
                tokenCount++
                // Emit a progress tick every 20 tokens so the UI shows activity
                if (tokenCount % 20 === 0) {
                  emit('progress', { tokenCount })
                }
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }

        if (!fullContent) {
          throw new EditorialAiError('LLM_EMPTY', 'AI returned empty content')
        }

        emit('status', { stage: 'saving', message: 'Validating and saving cards…' })

        // --- Parse, validate, save ---
        const parseResult = parseAndValidateGeneration(fullContent)
        if (!parseResult.success) {
          emit('error', { code: 'SCHEMA_MISMATCH', message: 'Generated output did not match schema', issues: parseResult.issues })
          controller.close()
          return
        }

        const cards = parseResult.data.cards
        const validationIssues = resolvedRole === 'ADMIN'
          ? validateAdminCards({ cards, promptText: parsed.promptText })
          : []

        const topicId = await ensureEditorialTopic(surgeryId, resolvedRole)
        const tagNormMap = buildTagNormMap(availableTagNames)
        const now = new Date()

        const batch = await prisma.dailyDoseGenerationBatch.create({
          data: {
            surgeryId,
            createdBy: user.id,
            promptText: parsed.promptText,
            targetRole: resolvedRole,
            status: 'DRAFT',
          },
        })

        const cardCreates = cards.slice(0, parsed.count).map((card) => {
          const combined = JSON.stringify(card)
          const inferredRisk = inferRiskLevel(combined)
          const riskLevel = inferredRisk === 'HIGH' ? 'HIGH' : card.riskLevel
          const reviewByDate = new Date(card.reviewByDate)
          const reviewByDateValid = !Number.isNaN(reviewByDate.getTime()) && reviewByDate > now
          const defaultReviewByDate = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)
          const cardTags = resolveCardTags(card.tags, tagNormMap)
          let normalizedSources = card.sources.map((s) => ({
            ...s,
            url: s.url && s.url.trim() ? s.url.trim() : null,
          }))
          if (resolvedRole === 'ADMIN' && normalizedSources.length > 0) {
            if (!normalizedSources[0]?.title?.startsWith('Signposting Toolkit')) {
              normalizedSources[0] = { title: 'Signposting Toolkit (internal)', url: normalizedSources[0]?.url ?? `/s/${surgeryId}`, publisher: 'Signposting Toolkit' }
            }
            normalizedSources = [normalizedSources[0], ...normalizedSources.slice(1).filter((s) => !s.title?.startsWith('Signposting Toolkit'))]
          }

          const cardIssues = validationIssues.filter((i) => !i.cardTitle || i.cardTitle === card.title)

          return prisma.dailyDoseCard.create({
            data: {
              batchId: batch.id,
              surgeryId,
              targetRole: card.targetRole,
              title: card.title,
              roleScope: [card.targetRole],
              topicId,
              contentBlocks: card.contentBlocks,
              interactions: card.interactions,
              slotLanguage: card.slotLanguage,
              safetyNetting: card.safetyNetting,
              sources: normalizedSources,
              estimatedTimeMinutes: card.estimatedTimeMinutes,
              riskLevel,
              needsSourcing: resolveNeedsSourcing(normalizedSources, card.needsSourcing) || !reviewByDateValid,
              reviewByDate: reviewByDateValid ? reviewByDate : defaultReviewByDate,
              tags: cardTags,
              status: 'DRAFT',
              createdBy: user.id,
              generatedFrom: {
                type: 'prompt',
                suggestedAssignments: inferredCategories.map((c) => ({
                  categoryId: c.categoryId,
                  categoryName: c.categoryName,
                  subsection: c.subsection,
                  confidence: c.confidence,
                })),
              },
              validationIssues: cardIssues.length > 0 ? cardIssues : null,
              clinicianApproved: false,
              publishedAt: null,
            },
          })
        })

        const createdCards = await prisma.$transaction(cardCreates)

        await prisma.dailyDoseQuiz.create({
          data: {
            batchId: batch.id,
            surgeryId,
            title: parseResult.data.quiz.title,
            questions: parseResult.data.quiz.questions,
          },
        })

        emit('complete', {
          batchId: batch.id,
          cardIds: createdCards.map((c) => c.id),
          hasValidationWarnings: validationIssues.length > 0,
          validationIssues: validationIssues.length > 0 ? validationIssues : undefined,
        })
      } catch (err) {
        if (err instanceof z.ZodError) {
          emit('error', { code: 'INVALID_INPUT', message: 'Invalid input', details: err.issues })
        } else if (err instanceof EditorialAiError) {
          emit('error', { code: err.code, message: err.message })
        } else {
          console.error('POST /api/editorial/generate/stream error', err)
          emit('error', { code: 'SERVER_ERROR', message: 'Internal server error' })
        }
      } finally {
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
