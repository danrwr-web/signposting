import 'server-only'

import { prisma } from '@/lib/prisma'
import { runGenerationJob } from '@/server/editorial/runGenerationJob'

/**
 * Time budget per invocation. Must be well under the platform's maxDuration
 * (300s on Vercel) to leave headroom for the final DB writes.
 * When the budget is exhausted the function stops gracefully; the status
 * polling endpoint detects remaining PENDING jobs and resumes via after().
 */
const TIME_BUDGET_MS = 240_000 // 240s — leaves 60s headroom

/** Minimum gap between consecutive AI calls to avoid Azure 429s. */
const THROTTLE_MS = 2_000

/**
 * Runs a batch of bulk-generation jobs within a time budget.
 *
 * On the first call (from the start route) it builds the full subsection
 * list and creates all DailyDoseGenerationJob rows in PENDING state, then
 * begins processing them sequentially.
 *
 * On continuation calls (from the status endpoint) it simply picks up
 * remaining PENDING jobs and keeps processing.
 *
 * When the time budget runs out the function returns and the client's
 * status poll will trigger another continuation.
 */
export async function runBulkGeneration(bulkRunId: string): Promise<void> {
  const startTime = Date.now()

  try {
    const run = await prisma.bulkGenerationRun.findUnique({
      where: { id: bulkRunId },
      select: { id: true, surgeryId: true, createdBy: true, status: true, totalSubsections: true },
    })
    if (!run || run.status === 'CANCELLED') return

    // First invocation: create all jobs upfront
    if (run.status === 'PENDING' || run.totalSubsections === 0) {
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

      // Create all jobs in one transaction
      await prisma.$transaction([
        ...subsections.map((item) =>
          prisma.dailyDoseGenerationJob.create({
            data: {
              surgeryId: run.surgeryId,
              createdBy: run.createdBy,
              bulkRunId,
              status: 'PENDING',
              promptText: item.subsection || item.categoryName,
              targetRole: 'ADMIN',
              count: 1,
              tags: [],
              interactiveFirst: true,
              categoryId: item.categoryId,
              categoryName: item.categoryName,
              subsection: item.subsection || null,
            },
          })
        ),
        prisma.bulkGenerationRun.update({
          where: { id: bulkRunId },
          data: { status: 'RUNNING', totalSubsections: subsections.length },
        }),
      ])
    }

    // Process PENDING jobs until time budget is exhausted or none remain
    let isFirstItem = true
    while (true) {
      // Time budget check
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        console.log(`[runBulkGeneration] Time budget exhausted after ${Math.round((Date.now() - startTime) / 1000)}s, pausing for continuation`)
        return
      }

      // Check for cancellation
      const currentRun = await prisma.bulkGenerationRun.findUnique({
        where: { id: bulkRunId },
        select: { status: true },
      })
      if (!currentRun || currentRun.status === 'CANCELLED') return

      // Pick up next PENDING job
      const nextJob = await prisma.dailyDoseGenerationJob.findFirst({
        where: { bulkRunId, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, categoryName: true, subsection: true },
      })
      if (!nextJob) break // All jobs processed

      // Throttle between AI calls
      if (!isFirstItem) {
        await new Promise(resolve => setTimeout(resolve, THROTTLE_MS))
      }
      isFirstItem = false

      try {
        await runGenerationJob(nextJob.id)
      } catch (error) {
        console.error('[runBulkGeneration] runGenerationJob threw for:', nextJob.categoryName, nextJob.subsection, error)
      }

      // Update bulk run counters
      const finishedJob = await prisma.dailyDoseGenerationJob.findUnique({
        where: { id: nextJob.id },
        select: { status: true },
      })
      const jobSucceeded = finishedJob?.status === 'COMPLETE'

      if (jobSucceeded) {
        await prisma.bulkGenerationRun.update({
          where: { id: bulkRunId },
          data: { completedCount: { increment: 1 } },
        })
      } else {
        const failedEntry = { categoryName: nextJob.categoryName, subsection: nextJob.subsection || '(All)' }
        const current = await prisma.bulkGenerationRun.findUnique({
          where: { id: bulkRunId },
          select: { failedSubsections: true },
        })
        const failed = Array.isArray(current?.failedSubsections) ? (current.failedSubsections as object[]) : []
        await prisma.bulkGenerationRun.update({
          where: { id: bulkRunId },
          data: {
            failedCount: { increment: 1 },
            failedSubsections: [...failed, failedEntry] as object[],
          },
        })
      }
    }

    // All jobs done — mark complete
    await prisma.bulkGenerationRun.update({
      where: { id: bulkRunId },
      data: { status: 'COMPLETE', completedAt: new Date() },
    })
  } catch (outerError) {
    console.error('[runBulkGeneration] Unexpected top-level error for run:', bulkRunId, outerError)
    // Don't mark COMPLETE on crash — let the status endpoint retry remaining jobs
    // Only mark COMPLETE if there are no remaining PENDING jobs
    try {
      const remainingJobs = await prisma.dailyDoseGenerationJob.count({
        where: { bulkRunId, status: 'PENDING' },
      })
      if (remainingJobs === 0) {
        await prisma.bulkGenerationRun.update({
          where: { id: bulkRunId },
          data: { status: 'COMPLETE', completedAt: new Date() },
        })
      }
    } catch {
      // Nothing more we can do
    }
  }
}
