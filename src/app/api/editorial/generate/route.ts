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
import { z } from 'zod'
import { randomUUID } from 'node:crypto'

// Force Node.js runtime and dynamic rendering to prevent 502s
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_GENERATIONS_PER_HOUR = 5

// Helper to compute debug enabled (automatic for editors/admins in non-production)
function isDebugEnabled(user: Awaited<ReturnType<typeof getSessionUser>>, surgeryId: string | null): boolean {
  if (process.env.NODE_ENV === 'production') return false
  if (!user || !surgeryId) return false
  return isDailyDoseAdmin(user, surgeryId)
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID()
  let debugEnabled = false
  let debugInfo: Partial<EditorialDebugInfo> & { stage: string; requestId: string } = {
    stage: 'start',
    requestId,
    toolkitInjected: false,
    matchedSymptoms: [],
    toolkitContextLength: 0,
  }

  // Top-level try/catch to prevent 502s - always return JSON
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
          ...(debugEnabled ? { debug: debugInfo } : {}),
        },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = EditorialGenerateRequestZ.parse(body)
    const surgeryId = resolveSurgeryIdForUser({ requestedId: parsed.surgeryId, user })
    
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
          ...(debugEnabled ? { debug: debugInfo } : {}),
        },
        { status: 403 }
      )
    }

    // Compute debug enabled (automatic for editors/admins in non-production)
    debugEnabled = isDebugEnabled(user, surgeryId)
    if (debugEnabled) {
      debugInfo.surgeryId = surgeryId
      debugInfo.targetRole = parsed.targetRole
      debugInfo.promptText = parsed.promptText
    }

    const since = new Date(Date.now() - 60 * 60 * 1000)
    const recentCount = await prisma.dailyDoseGenerationBatch.count({
      where: {
        createdBy: user.id,
        createdAt: { gte: since },
      },
    })
    if (recentCount >= MAX_GENERATIONS_PER_HOUR) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'RATE_LIMITED', message: 'Generation limit reached. Try again later.' },
          ...(debugEnabled ? { debug: debugInfo } : {}),
        },
        { status: 429 }
      )
    }

    const resolvedRole = resolveTargetRole({
      promptText: parsed.promptText,
      requestedRole: parsed.targetRole,
    })
    
    if (debugEnabled) {
      debugInfo.targetRole = resolvedRole
      debugInfo.stage = 'toolkit'
    }

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

    if (debugEnabled) {
      debugInfo.stage = 'before_model'
    }

    const generated = await generateEditorialBatch({
      surgeryId,
      promptText: parsed.promptText,
      targetRole: resolvedRole,
      count: parsed.count,
      tags: parsed.tags,
      interactiveFirst: parsed.interactiveFirst,
      requestId,
      userId: user.id,
      onAttempt: recordAttempt,
      returnDebugInfo: debugEnabled,
    })

    // Capture debug info if available (for inclusion in response)
    if ('debug' in generated && generated.debug) {
      debugInfo = { ...debugInfo, ...generated.debug }
    }
    
    if (debugEnabled) {
      debugInfo.stage = 'after_model'
    }

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
      },
    })

    await prisma.dailyDoseGenerationAttempt.updateMany({
      where: { requestId },
      data: { batchId: batch.id },
    })

    if (debugEnabled) {
      debugInfo.stage = 'after_parse'
    }

    const cardCreates = generated.cards.slice(0, parsed.count).map((card) => {
      // Normalize sources: convert empty string/whitespace URLs to null
      let normalizedSources = card.sources.map((source) => ({
        ...source,
        url: source.url && source.url.trim() ? source.url.trim() : null,
      }))

      // For ADMIN role: ensure sources[0] is Signposting Toolkit (internal) with url null
      // This prevents random model variance from causing safety validation failures
      if (resolvedRole === 'ADMIN') {
        const toolkitSource = {
          title: 'Signposting Toolkit (internal)',
          url: null as string | null,
          publisher: 'Signposting Toolkit',
        }
        // Check if first source is already the toolkit source
        const firstIsToolkit =
          normalizedSources[0]?.title === toolkitSource.title &&
          normalizedSources[0]?.url === null
        if (!firstIsToolkit) {
          // Replace sources array to ensure toolkit is first
          normalizedSources = [toolkitSource, ...normalizedSources.filter((s) => s.title !== toolkitSource.title)]
        }
      }

      const combined = JSON.stringify(card)
      const inferredRisk = inferRiskLevel(combined)
      const riskLevel = inferredRisk === 'HIGH' ? 'HIGH' : card.riskLevel
      const reviewByDate = new Date(card.reviewByDate)
      const reviewByDateValid = !Number.isNaN(reviewByDate.getTime())
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
          reviewByDate: reviewByDateValid ? reviewByDate : null,
          tags: card.tags,
          status: 'DRAFT',
          createdBy: user.id,
          generatedFrom: { type: 'prompt' },
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

    if (debugEnabled) {
      debugInfo.stage = 'after_safety'
    }

    return NextResponse.json({
      ok: true,
      batchId: batch.id,
      cardIds: createdCards.map((card) => card.id),
      quizId: quiz.id,
      createdAt: now,
      traceId: generated.traceId,
      // Include inline debug info (automatic for editors/admins in non-production)
      ...(debugEnabled ? { debug: debugInfo } : {}),
    })
  } catch (error) {
    // Always return JSON - never throw uncaught exceptions (prevents 502s)
    if (debugEnabled) {
      debugInfo.stage = 'error'
      if (error instanceof Error) {
        debugInfo.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      }
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues },
          ...(debugEnabled ? { debug: debugInfo } : {}),
        },
        { status: 400 }
      )
    }
    
    if (error instanceof EditorialAiError) {
      if (error.code === 'SCHEMA_MISMATCH') {
        const details = error.details as
          | { requestId?: string; issues?: Array<{ path: string; message: string }>; rawSnippet?: string; traceId?: string; debug?: EditorialDebugInfo }
          | undefined
        
        if (debugEnabled && details?.debug) {
          debugInfo = { ...debugInfo, ...details.debug, schemaErrors: details?.issues }
        }
        
        return NextResponse.json(
          {
            ok: false,
            errorCode: 'SCHEMA_MISMATCH',
            requestId: details?.requestId ?? requestId,
            traceId: details?.traceId,
            issues: details?.issues ?? [],
            rawSnippet: debugEnabled ? details?.rawSnippet : undefined,
            error: { 
              code: 'SCHEMA_MISMATCH', 
              message: 'Generated output did not match schema. Check Debug panel for details.' 
            },
            // Include inline debug info (automatic for editors/admins in non-production)
            ...(debugEnabled ? { debug: debugInfo } : {}),
          },
          { status: 500 }
        )
      }

      if (error.code === 'VALIDATION_FAILED') {
        const details = error.details as
          | { issues?: Array<{ code: string; message: string; cardTitle?: string }>; traceId?: string; debug?: EditorialDebugInfo }
          | undefined
        
        if (debugEnabled && details?.debug) {
          debugInfo = { ...debugInfo, ...details.debug, safetyErrors: details?.issues }
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
            // Include inline debug info (automatic for editors/admins in non-production)
            ...(debugEnabled ? { debug: debugInfo } : {}),
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        {
          ok: false,
          error: { code: error.code, message: error.message, details: error.details },
          requestId,
          ...(debugEnabled ? { debug: debugInfo } : {}),
        },
        { status: 500 }
      )
    }
    
    // Catch-all for unexpected errors
    console.error('POST /api/editorial/generate error', error)
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'SERVER_ERROR', message: 'Internal server error' },
        requestId,
        ...(debugEnabled ? { debug: debugInfo } : {}),
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
