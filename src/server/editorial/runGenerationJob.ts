import 'server-only'

import { prisma } from '@/lib/prisma'
import { type EditorialRole } from '@/lib/schemas/editorial'
import {
  generateEditorialBatch,
  EditorialAiError,
  type GenerationAttemptRecord,
} from '@/server/editorialAi'
import { inferRiskLevel, resolveNeedsSourcing } from '@/lib/editorial/guards'
import { resolveTargetRole } from '@/lib/editorial/roleRouting'
import { randomUUID } from 'node:crypto'

/**
 * Runs the full editorial generation for a background job.
 * Updates the job status to RUNNING, then COMPLETE or FAILED.
 */
export async function runGenerationJob(jobId: string): Promise<void> {
  const job = await prisma.dailyDoseGenerationJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      surgeryId: true,
      createdBy: true,
      promptText: true,
      targetRole: true,
      count: true,
      tags: true,
      interactiveFirst: true,
      status: true,
    },
  })

  if (!job || job.status !== 'PENDING') {
    return
  }

    const requestId = randomUUID()
    const resolvedRole = resolveTargetRole({
      promptText: job.promptText,
      requestedRole: job.targetRole as EditorialRole,
    })

  await prisma.dailyDoseGenerationJob.update({
    where: { id: jobId },
    data: { status: 'RUNNING' },
  })

  const recordAttempt = async (attempt: GenerationAttemptRecord) => {
    await prisma.dailyDoseGenerationAttempt.create({
      data: {
        requestId: attempt.requestId,
        attemptIndex: attempt.attemptIndex,
        modelName: attempt.modelName,
        promptText: job.promptText,
        targetRole: resolvedRole,
        rawModelOutput: attempt.rawModelOutput,
        rawModelJson: attempt.rawModelJson ?? undefined,
        validationErrors: attempt.validationErrors ?? undefined,
        status: attempt.status,
        surgeryId: job.surgeryId,
        createdBy: job.createdBy,
      },
    })
  }

  try {
    const generated = await generateEditorialBatch({
      surgeryId: job.surgeryId,
      promptText: job.promptText,
      targetRole: resolvedRole,
      count: job.count,
      interactiveFirst: job.interactiveFirst,
      requestId,
      userId: job.createdBy ?? undefined,
      onAttempt: recordAttempt,
      returnDebugInfo: false,
    })

    const topicId = await ensureEditorialTopic(job.surgeryId, resolvedRole)
    const now = new Date()

    const batch = await prisma.dailyDoseGenerationBatch.create({
      data: {
        surgeryId: job.surgeryId,
        createdBy: job.createdBy,
        promptText: job.promptText,
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

    const cardCreates = generated.cards.slice(0, job.count).map((card) => {
      const combined = JSON.stringify(card)
      const inferredRisk = inferRiskLevel(combined)
      const riskLevel = inferredRisk === 'HIGH' ? 'HIGH' : card.riskLevel
      const cardNow = new Date()
      const reviewByDate = new Date(card.reviewByDate)
      const reviewByDateValid = !Number.isNaN(reviewByDate.getTime()) && reviewByDate > cardNow
      const defaultReviewByDate = new Date(cardNow.getTime() + 180 * 24 * 60 * 60 * 1000) // 6 months (180 days) from now

      let normalizedSources = card.sources.map((source) => ({
        ...source,
        url: source.url === '' || (source.url && source.url.trim() === '') ? null : source.url,
      }))

      if (resolvedRole === 'ADMIN' && normalizedSources.length > 0) {
        normalizedSources[0] = {
          title: 'Signposting Toolkit (internal)',
          url: null,
          publisher: 'Signposting Toolkit',
        }
      }

      const needsSourcing =
        resolveNeedsSourcing(normalizedSources, card.needsSourcing) || !reviewByDateValid

      return prisma.dailyDoseCard.create({
        data: {
          batchId: batch.id,
          surgeryId: job.surgeryId,
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
          tags: [],
          status: 'DRAFT',
          createdBy: job.createdBy,
          generatedFrom: { type: 'prompt' },
          clinicianApproved: false,
          publishedAt: null,
        },
      })
    })

    await prisma.$transaction(cardCreates)

    await prisma.dailyDoseQuiz.create({
      data: {
        batchId: batch.id,
        surgeryId: job.surgeryId,
        title: generated.quiz.title,
        questions: generated.quiz.questions,
      },
    })

    await prisma.dailyDoseGenerationJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETE',
        batchId: batch.id,
        completedAt: now,
      },
    })
  } catch (error) {
    const message =
      error instanceof EditorialAiError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Generation failed'
    await prisma.dailyDoseGenerationJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        errorMessage: message,
        completedAt: new Date(),
      },
    })
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
