import 'server-only'

import { prisma } from '@/lib/prisma'
import { runGenerationJob } from '@/server/editorial/runGenerationJob'

/**
 * Runs a full bulk generation sequentially inside an after() callback.
 * Merges the orchestrator (fetch categories, build subsection list) and
 * child (create job, run generation, update counts) logic that previously
 * lived in Inngest functions.
 */
export async function runBulkGeneration(bulkRunId: string): Promise<void> {
  try {
    const run = await prisma.bulkGenerationRun.findUnique({
      where: { id: bulkRunId },
      select: { id: true, surgeryId: true, createdBy: true, status: true },
    })
    if (!run || run.status === 'CANCELLED') return

    // Build flat list of subsections from active learning categories
    const categories = await prisma.learningCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, subsections: true },
      orderBy: { ordering: 'asc' },
    })

    const subsections: Array<{ categoryId: string; categoryName: string; subsection: string }> = []
    for (const cat of categories) {
      const subs = Array.isArray(cat.subsections) ? (cat.subsections as string[]) : []
      if (subs.length > 0) {
        for (const sub of subs) {
          subsections.push({ categoryId: cat.id, categoryName: cat.name, subsection: sub })
        }
      } else {
        subsections.push({ categoryId: cat.id, categoryName: cat.name, subsection: '' })
      }
    }

    await prisma.bulkGenerationRun.update({
      where: { id: bulkRunId },
      data: { status: 'RUNNING', totalSubsections: subsections.length },
    })

    // Process each subsection sequentially with throttling to avoid Azure 429s
    const THROTTLE_MS = 2_000
    let isFirstItem = true
    for (const item of subsections) {
      if (!isFirstItem) {
        await new Promise(resolve => setTimeout(resolve, THROTTLE_MS))
      }
      isFirstItem = false
      // Check for cancellation before each card
      const currentRun = await prisma.bulkGenerationRun.findUnique({
        where: { id: bulkRunId },
        select: { status: true },
      })
      if (!currentRun || currentRun.status === 'CANCELLED') break

      const promptText = item.subsection || item.categoryName
      const job = await prisma.dailyDoseGenerationJob.create({
        data: {
          surgeryId: run.surgeryId,
          createdBy: run.createdBy,
          bulkRunId,
          status: 'PENDING',
          promptText,
          targetRole: 'ADMIN',
          count: 1,
          tags: [],
          interactiveFirst: true,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          subsection: item.subsection || null,
        },
      })

      // runGenerationJob catches errors internally and sets job status to FAILED
      // without re-throwing, so we must check the job's actual DB status afterwards.
      try {
        await runGenerationJob(job.id)
      } catch (error) {
        console.error('[runBulkGeneration] runGenerationJob threw for subsection:', item.categoryName, item.subsection, error)
      }

      const finishedJob = await prisma.dailyDoseGenerationJob.findUnique({
        where: { id: job.id },
        select: { status: true },
      })
      const jobSucceeded = finishedJob?.status === 'COMPLETE'

      if (jobSucceeded) {
        await prisma.$transaction(async (tx) => {
          const updated = await tx.bulkGenerationRun.update({
            where: { id: bulkRunId },
            data: { completedCount: { increment: 1 } },
            select: { completedCount: true, failedCount: true, totalSubsections: true },
          })
          if (updated.completedCount + updated.failedCount >= updated.totalSubsections) {
            await tx.bulkGenerationRun.update({
              where: { id: bulkRunId },
              data: { status: 'COMPLETE', completedAt: new Date() },
            })
          }
        })
      } else {
        const failedEntry = { categoryName: item.categoryName, subsection: item.subsection || '(All)' }
        await prisma.$transaction(async (tx) => {
          const current = await tx.bulkGenerationRun.findUnique({
            where: { id: bulkRunId },
            select: { failedSubsections: true, completedCount: true, failedCount: true, totalSubsections: true },
          })
          if (!current) return
          const failed = Array.isArray(current.failedSubsections) ? (current.failedSubsections as object[]) : []
          await tx.bulkGenerationRun.update({
            where: { id: bulkRunId },
            data: {
              failedCount: { increment: 1 },
              failedSubsections: [...failed, failedEntry] as object[],
            },
          })
          const afterUpdate = await tx.bulkGenerationRun.findUnique({
            where: { id: bulkRunId },
            select: { completedCount: true, failedCount: true, totalSubsections: true },
          })
          if (afterUpdate && afterUpdate.completedCount + afterUpdate.failedCount >= afterUpdate.totalSubsections) {
            await tx.bulkGenerationRun.update({
              where: { id: bulkRunId },
              data: { status: 'COMPLETE', completedAt: new Date() },
            })
          }
        })
      }
    }

    // Safety net: if loop finished naturally and status is still RUNNING, mark COMPLETE
    const finalRun = await prisma.bulkGenerationRun.findUnique({
      where: { id: bulkRunId },
      select: { status: true },
    })
    if (finalRun && finalRun.status === 'RUNNING') {
      await prisma.bulkGenerationRun.update({
        where: { id: bulkRunId },
        data: { status: 'COMPLETE', completedAt: new Date() },
      })
    }
  } catch (outerError) {
    // Crash recovery: mark run COMPLETE so it doesn't get stuck in RUNNING forever
    console.error('[runBulkGeneration] Unexpected top-level error for run:', bulkRunId, outerError)
    try {
      await prisma.bulkGenerationRun.update({
        where: { id: bulkRunId },
        data: { status: 'COMPLETE', completedAt: new Date() },
      })
    } catch {
      // Nothing more we can do
    }
  }
}
