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
import { inferLearningCategories, type LearningCategoryRef } from '@/lib/editorial/inferLearningCategory'
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
    const availableTags = await prisma.dailyDoseTag.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    })
    const availableTagNames = availableTags.map((t) => t.name)

    // Load active learning categories for inference
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
    let inferredCategories = inferLearningCategories(job.promptText, categoryRefs)

    // Category-name fallback: if no subsection match, try matching against category names
    if (inferredCategories.length === 0 && categoryRefs.length > 0) {
      const promptLower = job.promptText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
      const promptTokens = promptLower.split(/\s+/).filter((t) => t.length >= 3)
      if (promptTokens.length > 0) {
        let best: { id: string; name: string } | null = null
        let bestScore = 0
        for (const cat of categoryRefs) {
          const nameTokens = cat.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length >= 3)
          let score = 0
          for (const pt of promptTokens) {
            if (nameTokens.includes(pt)) score += 3
            else if (cat.name.toLowerCase().includes(pt)) score += 1
          }
          if (score > bestScore) { bestScore = score; best = { id: cat.id, name: cat.name } }
        }
        if (best && bestScore >= 2) {
          inferredCategories = [{ categoryId: best.id, categoryName: best.name, subsection: '', confidence: 'low' }]
        }
      }
    }

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
      availableTagNames: availableTagNames.length > 0 ? availableTagNames : undefined,
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

    // Build normalised tag lookup map for case/punctuation-insensitive matching
    const tagNormMap = new Map(availableTagNames.map((n) => [
      n.toLowerCase().replace(/[''`]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim(),
      n,
    ]))
    const cardCreates = generated.cards.slice(0, job.count).map((card) => {
      const combined = JSON.stringify(card)
      const inferredRisk = inferRiskLevel(combined)
      const riskLevel = inferredRisk === 'HIGH' ? 'HIGH' : card.riskLevel
      const cardNow = new Date()
      const reviewByDate = new Date(card.reviewByDate)
      const reviewByDateValid = !Number.isNaN(reviewByDate.getTime()) && reviewByDate > cardNow
      const defaultReviewByDate = new Date(cardNow.getTime() + 180 * 24 * 60 * 60 * 1000) // 6 months (180 days) from now
      const cardTags = (Array.isArray(card.tags) ? card.tags : [])
        .map((t: unknown): string | null => {
          if (typeof t !== 'string') return null
          const key = t.toLowerCase().replace(/[''`]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
          return tagNormMap.get(key) ?? null
        })
        .filter((t): t is string => t !== null)

      let normalizedSources = card.sources.map((source) => ({
        ...source,
        url: source.url === '' || (source.url && source.url.trim() === '') ? null : source.url,
      }))

      // For ADMIN role, ensure sources[0] is a Signposting Toolkit source.
      // generateEditorialBatch already sets per-card toolkit sources; this is a safety net.
      if (resolvedRole === 'ADMIN' && normalizedSources.length > 0) {
        if (!normalizedSources[0]?.title?.startsWith('Signposting Toolkit')) {
          normalizedSources[0] = {
            title: 'Signposting Toolkit (internal)',
            url: normalizedSources[0]?.url ?? null,
            publisher: 'Signposting Toolkit',
          }
        }
        // Remove any duplicate toolkit sources beyond index 0
        normalizedSources = [
          normalizedSources[0],
          ...normalizedSources.slice(1).filter((s: any) => !s.title?.startsWith('Signposting Toolkit')),
        ]
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
          tags: cardTags,
          status: 'DRAFT',
          createdBy: job.createdBy,
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
    // If validation failed but we have cards, save them as DRAFT with per-card validationIssues
    if (
      error instanceof EditorialAiError &&
      error.code === 'VALIDATION_FAILED'
    ) {
      const details = error.details as
        | {
            issues?: Array<{ code: string; message: string; cardTitle?: string }>
            cards?: Array<any>
          }
        | undefined

      if (details?.cards && details.cards.length > 0) {
        try {
          const resolvedRoleForSave = resolveTargetRole({
            promptText: job.promptText,
            requestedRole: job.targetRole as EditorialRole,
          })
          const topicId = await ensureEditorialTopic(job.surgeryId, resolvedRoleForSave)
          const availableTagsForSave = await prisma.dailyDoseTag.findMany({ select: { name: true } })
          const tagNormMapForSave = new Map(availableTagsForSave.map((t) => [
            t.name.toLowerCase().replace(/[''`]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim(),
            t.name,
          ]))
          const issues = details.issues ?? []

          const batch = await prisma.dailyDoseGenerationBatch.create({
            data: {
              surgeryId: job.surgeryId,
              createdBy: job.createdBy,
              promptText: job.promptText,
              targetRole: resolvedRoleForSave,
              status: 'DRAFT',
            },
          })

          await prisma.dailyDoseGenerationAttempt.updateMany({
            where: { requestId },
            data: { batchId: batch.id },
          })

          const now2 = new Date()
          const cardCreates = details.cards.map((card: any) => {
            const reviewByDate = new Date(card.reviewByDate)
            const reviewByDateValid = !Number.isNaN(reviewByDate.getTime()) && reviewByDate > now2
            const defaultReviewByDate = new Date(now2.getTime() + 180 * 24 * 60 * 60 * 1000)
            const cardTags = (Array.isArray(card.tags) ? card.tags : [])
              .map((t: unknown): string | null => {
                if (typeof t !== 'string') return null
                const key = t.toLowerCase().replace(/[''`]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
                return tagNormMapForSave.get(key) ?? null
              })
              .filter((t): t is string => t !== null)

            let normalizedSources = (card.sources || []).map((source: any) => ({
              ...source,
              url: source.url === '' || (source.url && source.url.trim() === '') ? null : source.url,
            }))
            if (resolvedRoleForSave === 'ADMIN' && normalizedSources.length > 0) {
              if (!normalizedSources[0]?.title?.startsWith('Signposting Toolkit')) {
                normalizedSources[0] = {
                  title: 'Signposting Toolkit (internal)',
                  url: normalizedSources[0]?.url ?? null,
                  publisher: 'Signposting Toolkit',
                }
              }
              normalizedSources = [
                normalizedSources[0],
                ...normalizedSources.slice(1).filter((s: any) => !s.title?.startsWith('Signposting Toolkit')),
              ]
            }

            const cardIssues = issues.filter(
              (i) => !i.cardTitle || i.cardTitle === card.title
            )

            return prisma.dailyDoseCard.create({
              data: {
                batchId: batch.id,
                surgeryId: job.surgeryId,
                targetRole: card.targetRole ?? resolvedRoleForSave,
                title: card.title,
                roleScope: [card.targetRole ?? resolvedRoleForSave],
                topicId,
                contentBlocks: card.contentBlocks ?? [],
                interactions: card.interactions ?? [],
                slotLanguage: card.slotLanguage ?? null,
                safetyNetting: card.safetyNetting ?? [],
                sources: normalizedSources,
                estimatedTimeMinutes: card.estimatedTimeMinutes ?? 5,
                riskLevel: card.riskLevel ?? 'LOW',
                needsSourcing: !reviewByDateValid,
                reviewByDate: reviewByDateValid ? reviewByDate : defaultReviewByDate,
                tags: cardTags,
                status: 'DRAFT',
                createdBy: job.createdBy,
                validationIssues: cardIssues.length > 0 ? cardIssues : null,
                clinicianApproved: false,
                publishedAt: null,
              },
            })
          })

          await prisma.$transaction(cardCreates)

          await prisma.dailyDoseGenerationJob.update({
            where: { id: jobId },
            data: {
              status: 'COMPLETE',
              batchId: batch.id,
              completedAt: new Date(),
            },
          })
          return
        } catch (saveError) {
          console.error('[runGenerationJob] Failed to save flagged cards:', saveError)
          // Fall through to mark job as FAILED below
        }
      }
    }

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
