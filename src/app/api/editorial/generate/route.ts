import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { EditorialGenerateRequestZ, type EditorialRole } from '@/lib/schemas/editorial'
import {
  generateEditorialBatch,
  EditorialAiError,
  type GenerationAttemptRecord,
  type EditorialDebugInfo,
} from '@/server/editorialAi'
import { inferRiskLevel, resolveNeedsSourcing } from '@/lib/editorial/guards'
import { resolveTargetRole } from '@/lib/editorial/roleRouting'
import { inferLearningCategories, type LearningCategoryRef } from '@/lib/editorial/inferLearningCategory'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'

// Force Node.js runtime and prevent edge timeouts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for generating multiple cards

const MAX_GENERATIONS_PER_HOUR = 5

/**
 * Normalise a tag string for fuzzy matching: lowercase, strip apostrophes/punctuation,
 * collapse whitespace. Used to match AI-proposed tags to canonical DB tag names
 * regardless of capitalisation or minor punctuation differences.
 */
function normaliseTagKey(t: string): string {
  return t
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Build a normalised tag lookup map from the canonical DB tag names.
 * Key: normalised form, Value: canonical name as stored in DB.
 */
function buildTagNormMap(tagNames: string[]): Map<string, string> {
  return new Map(tagNames.map((n) => [normaliseTagKey(n), n]))
}

/**
 * Resolve card tags from AI output against the canonical tag list.
 * Uses normalised matching so "Women's Health" matches "womens health" etc.
 * Returns the canonical DB names for any tags that match.
 */
function resolveCardTags(aiTags: unknown[], tagNormMap: Map<string, string>): string[] {
  return (Array.isArray(aiTags) ? aiTags : [])
    .map((t): string | null => {
      if (typeof t !== 'string') return null
      return tagNormMap.get(normaliseTagKey(t.trim())) ?? null
    })
    .filter((t): t is string => t !== null)
}

/**
 * Match a prompt against category names using token scoring.
 * Returns the best-matching category (score ≥ 2) or null.
 * Used as a fallback when subsection-level inference returns nothing.
 */
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
    if (score > bestScore) {
      bestScore = score
      best = { id: cat.id, name: cat.name }
    }
  }

  return bestScore >= 2 ? best : null
}

// Build partial debug info for early errors (before generation)
function buildPartialDebug(params: {
  requestId: string
  stage: string
  surgeryId?: string
  targetRole?: string
  promptText?: string
  error?: Error
}): Partial<EditorialDebugInfo> {
  return {
    traceId: params.requestId,
    toolkitInjected: false,
    matchedSymptoms: [],
    toolkitContextLength: 0,
    promptSystem: '',
    promptUser: '',
    ...(params.error
      ? { error: { name: params.error.name, message: params.error.message, stack: params.error.stack }, stage: params.stage, requestId: params.requestId }
      : { stage: params.stage, requestId: params.requestId }),
  }
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID()
  let debugEnabled = false
  let debugInfo: EditorialDebugInfo | null = null
  let surgeryId: string | null = null
  let resolvedRole: EditorialRole | null = null
  let promptText: string | null = null
  let stage = 'initialization'
  let user: Awaited<ReturnType<typeof getSessionUser>> = null
  let isSuperuser = false
  let availableTagNames: string[] = []

  // Top-level try/catch to prevent 502 errors
  try {
    stage = 'authentication'
    user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    stage = 'validation'
    const body = await request.json()
    const parsed = EditorialGenerateRequestZ.parse(body)
    surgeryId = resolveSurgeryIdForUser({ requestedId: parsed.surgeryId, user })
    promptText = parsed.promptText
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }
    // Superusers always get debug/insights data; other admins only in non-production
    isSuperuser = user.globalRole === 'SUPERUSER'
    debugEnabled = isSuperuser || (process.env.NODE_ENV !== 'production' && user.memberships?.some((m: any) => m.role === 'ADMIN'))

    stage = 'rate_limit_check'
    const since = new Date(Date.now() - 60 * 60 * 1000)
    const recentCount = await prisma.dailyDoseGenerationBatch.count({
      where: {
        createdBy: user.id,
        createdAt: { gte: since },
      },
    })
    if (recentCount >= MAX_GENERATIONS_PER_HOUR) {
      return NextResponse.json(
        { ok: false, error: { code: 'RATE_LIMITED', message: 'Generation limit reached. Try again later.' } },
        { status: 429 }
      )
    }

    stage = 'role_resolution'
    resolvedRole = resolveTargetRole({
      promptText: parsed.promptText,
      requestedRole: parsed.targetRole,
    })

    const recordAttempt = async (attempt: GenerationAttemptRecord) => {
      await prisma.dailyDoseGenerationAttempt.create({
        data: {
          requestId: attempt.requestId,
          attemptIndex: attempt.attemptIndex,
          modelName: attempt.modelName,
          promptText: parsed.promptText,
          targetRole: resolvedRole,
          rawModelOutput: attempt.rawModelOutput,
          rawModelJson: attempt.rawModelJson ?? undefined,
          validationErrors: attempt.validationErrors ?? undefined,
          status: attempt.status,
          surgeryId,
          createdBy: user.id,
        },
      })
    }

    stage = 'toolkit_resolve'
    const availableTags = await prisma.dailyDoseTag.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    })
    availableTagNames = availableTags.map((t) => t.name)

    // Load active learning categories for category inference
    const learningCategories = await prisma.learningCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, subsections: true },
      orderBy: { ordering: 'asc' },
    })
    const categoryRefs: LearningCategoryRef[] = learningCategories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      subsections: Array.isArray(c.subsections) ? (c.subsections as string[]) : [],
    }))
    let inferredCategories = inferLearningCategories(parsed.promptText, categoryRefs)

    // Category-name fallback: if no subsection-level match, try matching the prompt
    // against category names themselves (e.g. "respiratory" → Respiratory & ENT).
    if (inferredCategories.length === 0 && categoryRefs.length > 0) {
      const catMatch = matchCategoryByName(parsed.promptText, categoryRefs)
      if (catMatch) {
        inferredCategories = [{
          categoryId: catMatch.id,
          categoryName: catMatch.name,
          subsection: '',
          confidence: 'low',
        }]
      }
    }

    // Fetch published card titles for this surgery+role to avoid repeating them.
    // Match by inferred category IDs where possible, otherwise return all for the role.
    const inferredCategoryIds = inferredCategories.map((c) => c.categoryId)
    const existingPublishedCards = await prisma.dailyDoseCard.findMany({
      where: {
        surgeryId,
        targetRole: resolvedRole,
        status: 'PUBLISHED',
      },
      select: { title: true, learningAssignments: true },
      orderBy: { publishedAt: 'desc' },
      take: 100, // fetch more than we need, then filter/cap
    })
    // Prefer cards that match the inferred categories; fall back to all published cards
    const matchingCards = inferredCategoryIds.length > 0
      ? existingPublishedCards.filter((c) => {
          const assignments = Array.isArray(c.learningAssignments) ? c.learningAssignments as Array<{ categoryId: string }> : []
          return assignments.some((a) => inferredCategoryIds.includes(a.categoryId))
        })
      : existingPublishedCards
    const existingTitles = (matchingCards.length > 0 ? matchingCards : existingPublishedCards)
      .slice(0, 50)
      .map((c) => c.title)

    const generated = await generateEditorialBatch({
      surgeryId,
      promptText: parsed.promptText,
      targetRole: resolvedRole,
      count: parsed.count,
      interactiveFirst: parsed.interactiveFirst,
      requestId,
      userId: user.id,
      onAttempt: recordAttempt,
      returnDebugInfo: debugEnabled,
      overrideValidation: isSuperuser && parsed.overrideValidation === true,
      availableTagNames: availableTagNames.length > 0 ? availableTagNames : undefined,
      existingTitles: existingTitles.length > 0 ? existingTitles : undefined,
      // Superuser-only: use custom prompts instead of the auto-constructed ones
      ...(isSuperuser && parsed.systemPromptOverride ? { systemPromptOverride: parsed.systemPromptOverride } : {}),
      ...(isSuperuser && parsed.userPromptOverride ? { userPromptOverride: parsed.userPromptOverride } : {}),
    })

    // Capture debug info if available (for inclusion in response)
    if ('debug' in generated && generated.debug) {
      debugInfo = generated.debug
    }

    stage = 'model_call'
    // Model call is complete, stage will be updated in post-processing

    stage = 'parse_normalise'
    // Parse and normalise is complete

    stage = 'schema_validation'
    // Schema validation is complete

    stage = 'safety_validation'
    // Safety validation happens inside generateEditorialBatch for ADMIN role

    stage = 'database_write'
    const topicId = await ensureEditorialTopic(surgeryId, resolvedRole)
    const now = new Date()

    const batch = await prisma.dailyDoseGenerationBatch.create({
      data: {
        surgeryId,
        createdBy: user.id,
        promptText: parsed.promptText,
        targetRole: resolvedRole,
        modelUsed: generated.modelUsed,
        status: 'DRAFT',
        // Persist generation metadata for later review
        ...('generationMeta' in generated && generated.generationMeta
          ? { generationMeta: generated.generationMeta }
          : {}),
      },
    })

    await prisma.dailyDoseGenerationAttempt.updateMany({
      where: { requestId },
      data: { batchId: batch.id },
    })

    const tagNormMap = buildTagNormMap(availableTagNames)
    const cardCreates = generated.cards.slice(0, parsed.count).map((card) => {
      const combined = JSON.stringify(card)
      const inferredRisk = inferRiskLevel(combined)
      const riskLevel = inferredRisk === 'HIGH' ? 'HIGH' : card.riskLevel
      const now = new Date()
      const reviewByDate = new Date(card.reviewByDate)
      const reviewByDateValid = !Number.isNaN(reviewByDate.getTime()) && reviewByDate > now
      const defaultReviewByDate = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000) // 6 months (180 days) from now
      const cardTags = resolveCardTags(card.tags, tagNormMap)
      
      // Post-processing: Force ADMIN sources[0] to be deterministic
      let normalizedSources = card.sources.map((source) => ({
        ...source,
        url: (source.url === '' || (source.url && source.url.trim() === '')) ? null : source.url,
      }))
      
      // For ADMIN role, ensure sources[0] is a Signposting Toolkit source.
      // generateEditorialBatch already sets per-card toolkit sources; this is a safety net.
      if (resolvedRole === 'ADMIN' && normalizedSources.length > 0) {
        if (!normalizedSources[0]?.title?.startsWith('Signposting Toolkit')) {
          normalizedSources[0] = {
            title: 'Signposting Toolkit (internal)',
            url: normalizedSources[0]?.url ?? `/s/${surgeryId}`,
            publisher: 'Signposting Toolkit',
          }
        }
        // Remove any duplicate toolkit sources beyond index 0
        normalizedSources = [
          normalizedSources[0],
          ...normalizedSources.slice(1).filter((s) => !s.title?.startsWith('Signposting Toolkit')),
        ]
      }
      
      const needsSourcing = resolveNeedsSourcing(normalizedSources, card.needsSourcing) || !reviewByDateValid

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
          needsSourcing,
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
          clinicianApproved: false,
          publishedAt: null,
        },
      })
    })

    const createdCards = await prisma.$transaction(cardCreates)

    const quiz = await prisma.dailyDoseQuiz.create({
      data: {
        batchId: batch.id,
        surgeryId,
        title: generated.quiz.title,
        questions: generated.quiz.questions,
      },
    })

    stage = 'complete'
    return NextResponse.json({
      ok: true,
      batchId: batch.id,
      cardIds: createdCards.map((card) => card.id),
      quizId: quiz.id,
      createdAt: now,
      traceId: generated.traceId,
      // Include inline debug info (dev-only, when requested)
      ...(debugEnabled && debugInfo ? { debug: debugInfo } : {}),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 }
      )
    }
    if (error instanceof EditorialAiError) {
      if (error.code === 'SCHEMA_MISMATCH') {
        const details = error.details as
          | { requestId?: string; issues?: Array<{ path: string; message: string }>; rawSnippet?: string; traceId?: string; debug?: EditorialDebugInfo }
          | undefined
        const includeRawSnippet = isSuperuser || process.env.NODE_ENV !== 'production'
        return NextResponse.json(
          {
            ok: false,
            errorCode: 'SCHEMA_MISMATCH',
            requestId: details?.requestId ?? requestId,
            traceId: details?.traceId,
            issues: details?.issues ?? [],
            rawSnippet: includeRawSnippet ? details?.rawSnippet : undefined,
            error: { 
              code: 'SCHEMA_MISMATCH', 
              message: 'Generated output did not match schema. Check Generation Insights panel for details.' 
            },
            // Include inline debug info (dev-only)
            ...(debugEnabled && details?.debug ? { debug: details.debug } : {}),
          },
          { status: 502 }
        )
      }

      if (error.code === 'VALIDATION_FAILED') {
        const details = error.details as
          | {
              issues?: Array<{ code: string; message: string; cardTitle?: string }>
              cards?: Array<any>
              traceId?: string
              debug?: EditorialDebugInfo
            }
          | undefined

        // If we have the generated cards, save them as DRAFT with per-card validationIssues
        if (details?.cards && details.cards.length > 0 && surgeryId && resolvedRole && user) {
          try {
            const topicId = await ensureEditorialTopic(surgeryId, resolvedRole)
            const availableTagNames2 = availableTagNames ?? []
            const tagNormMap2 = buildTagNormMap(availableTagNames2)

            const batch = await prisma.dailyDoseGenerationBatch.create({
              data: {
                surgeryId,
                createdBy: user.id,
                promptText: promptText ?? '',
                targetRole: resolvedRole,
                status: 'DRAFT',
              },
            })

            await prisma.dailyDoseGenerationAttempt.updateMany({
              where: { requestId },
              data: { batchId: batch.id },
            })

            const now2 = new Date()
            const issues = details.issues ?? []

            const cardCreates2 = details.cards.map((card: any) => {
              const combined = JSON.stringify(card)
              const inferredRisk = inferRiskLevel(combined)
              const riskLevel = inferredRisk === 'HIGH' ? 'HIGH' : (card.riskLevel ?? 'LOW')
              const reviewByDate = new Date(card.reviewByDate)
              const reviewByDateValid = !Number.isNaN(reviewByDate.getTime()) && reviewByDate > now2
              const defaultReviewByDate = new Date(now2.getTime() + 180 * 24 * 60 * 60 * 1000)
              const cardTags = resolveCardTags(card.tags, tagNormMap2)

              let normalizedSources = (card.sources || []).map((source: any) => ({
                ...source,
                url: source.url === '' || (source.url && source.url.trim() === '') ? null : source.url,
              }))
              if (resolvedRole === 'ADMIN' && normalizedSources.length > 0) {
                if (!normalizedSources[0]?.title?.startsWith('Signposting Toolkit')) {
                  normalizedSources[0] = {
                    title: 'Signposting Toolkit (internal)',
                    url: normalizedSources[0]?.url ?? `/s/${surgeryId}`,
                    publisher: 'Signposting Toolkit',
                  }
                }
                normalizedSources = [
                  normalizedSources[0],
                  ...normalizedSources.slice(1).filter((s: any) => !s.title?.startsWith('Signposting Toolkit')),
                ]
              }

              // Tag this card's validation issues (per-card matching on title)
              const cardIssues = issues.filter(
                (i) => !i.cardTitle || i.cardTitle === card.title
              )

              return prisma.dailyDoseCard.create({
                data: {
                  batchId: batch.id,
                  surgeryId,
                  targetRole: card.targetRole ?? resolvedRole,
                  title: card.title,
                  roleScope: [card.targetRole ?? resolvedRole],
                  topicId,
                  contentBlocks: card.contentBlocks ?? [],
                  interactions: card.interactions ?? [],
                  slotLanguage: card.slotLanguage ?? null,
                  safetyNetting: card.safetyNetting ?? [],
                  sources: normalizedSources,
                  estimatedTimeMinutes: card.estimatedTimeMinutes ?? 5,
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

            const savedCards = await prisma.$transaction(cardCreates2)

            return NextResponse.json({
              ok: true,
              batchId: batch.id,
              cardIds: savedCards.map((c) => c.id),
              hasValidationWarnings: true,
              validationIssues: issues,
              traceId: details?.traceId ?? undefined,
              ...(debugEnabled && details?.debug ? { debug: details.debug } : {}),
            })
          } catch (saveError) {
            console.error('POST /api/editorial/generate: failed to save flagged cards', saveError)
            // Fall through to return the original validation error
          }
        }

        return NextResponse.json(
          {
            ok: false,
            error: {
              code: 'SAFETY_VALIDATION_FAILED',
              message: error.message,
              details: details?.issues ?? [],
            },
            traceId: details?.traceId ?? undefined,
            requestId,
            ...(debugEnabled && details?.debug ? { debug: details.debug } : {}),
          },
          { status: 502 }
        )
      }

      return NextResponse.json(
        { 
          ok: false,
          error: { code: error.code, message: error.message, details: error.details, requestId },
          ...(debugEnabled ? { debug: buildPartialDebug({ requestId, stage, surgeryId: surgeryId ?? undefined, targetRole: resolvedRole ?? undefined, promptText: promptText ?? undefined, error: error instanceof Error ? error : new Error(String(error)) }) } : {}),
        },
        { status: 502 }
      )
    }
    console.error('POST /api/editorial/generate error', error)
    const errorObj = error instanceof Error ? error : new Error(String(error))
    return NextResponse.json(
      { 
        ok: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' },
        ...(debugEnabled ? { 
          debug: buildPartialDebug({ 
            requestId, 
            stage, 
            surgeryId: surgeryId ?? undefined, 
            targetRole: resolvedRole ?? undefined, 
            promptText: promptText ?? undefined, 
            error: errorObj 
          }) 
        } : {}),
      },
      { status: 500 }
    )
  }
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
    data: {
      surgeryId,
      name,
      roleScope: [role],
      ordering: 0,
      isActive: true,
    },
  })
  return created.id
}
