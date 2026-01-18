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
} from '@/server/editorialAi'
import { inferRiskLevel, resolveNeedsSourcing } from '@/lib/editorial/guards'
import { resolveTargetRole } from '@/lib/editorial/roleRouting'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'

const MAX_GENERATIONS_PER_HOUR = 5

export async function POST(request: NextRequest) {
  let requestId: string | null = null
  let allowDiagnostics = false
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = EditorialGenerateRequestZ.parse(body)
    const surgeryId = resolveSurgeryIdForUser({ requestedId: parsed.surgeryId, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }
    allowDiagnostics = true

    const since = new Date(Date.now() - 60 * 60 * 1000)
    const recentCount = await prisma.dailyDoseGenerationBatch.count({
      where: {
        createdBy: user.id,
        createdAt: { gte: since },
      },
    })
    if (recentCount >= MAX_GENERATIONS_PER_HOUR) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Generation limit reached. Try again later.' } },
        { status: 429 }
      )
    }

    requestId = randomUUID()
    const resolvedRole = resolveTargetRole({
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

    const generated = await generateEditorialBatch({
      promptText: parsed.promptText,
      targetRole: resolvedRole,
      count: parsed.count,
      tags: parsed.tags,
      interactiveFirst: parsed.interactiveFirst,
      requestId,
      onAttempt: recordAttempt,
    })

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

    const cardCreates = generated.cards.slice(0, parsed.count).map((card) => {
      const combined = JSON.stringify(card)
      const inferredRisk = inferRiskLevel(combined)
      const riskLevel = inferredRisk === 'HIGH' ? 'HIGH' : card.riskLevel
      const reviewByDate = new Date(card.reviewByDate)
      const reviewByDateValid = !Number.isNaN(reviewByDate.getTime())
      const needsSourcing = resolveNeedsSourcing(card.sources, card.needsSourcing) || !reviewByDateValid

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
          sources: card.sources,
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

    return NextResponse.json({
      batchId: batch.id,
      cardIds: createdCards.map((card) => card.id),
      quizId: quiz.id,
      createdAt: now,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 }
      )
    }
    if (error instanceof EditorialAiError) {
      if (error.code === 'SCHEMA_MISMATCH') {
        const details = error.details as
          | { requestId?: string; issues?: Array<{ path: string; message: string }>; rawSnippet?: string }
          | undefined
        const includeRawSnippet = process.env.NODE_ENV !== 'production' || allowDiagnostics
        return NextResponse.json(
          {
            errorCode: 'SCHEMA_MISMATCH',
            requestId: details?.requestId ?? requestId,
            issues: details?.issues ?? [],
            rawSnippet: includeRawSnippet ? details?.rawSnippet : undefined,
          },
          { status: 502 }
        )
      }

      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details, requestId } },
        { status: 502 }
      )
    }
    console.error('POST /api/editorial/generate error', error)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
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
