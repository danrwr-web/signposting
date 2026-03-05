import 'server-only'

import { inngest } from '@/inngest/client'
import { prisma } from '@/lib/prisma'
import { runGenerationJob } from '@/server/editorial/runGenerationJob'

type BulkChildPayload = {
  bulkRunId: string
  surgeryId: string
  createdBy: string | null
  categoryId: string
  categoryName: string
  subsection: string
}

/**
 * Orchestrator: fetches subsections and fans out to child jobs.
 */
export const bulkGenerationOrchestrator = inngest.createFunction(
  {
    id: 'bulk-generation-orchestrator',
    concurrency: { limit: 1 }, // Only one bulk run at a time per app
  },
  { event: 'editorial/bulk.generate.start' },
  async ({ event }) => {
    const { bulkRunId, surgeryId, createdBy } = event.data as {
      bulkRunId: string
      surgeryId: string
      createdBy: string | null
    }

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
          subsections.push({
            categoryId: cat.id,
            categoryName: cat.name,
            subsection: sub,
          })
        }
      } else {
        subsections.push({
          categoryId: cat.id,
          categoryName: cat.name,
          subsection: '',
        })
      }
    }

    await prisma.bulkGenerationRun.update({
      where: { id: bulkRunId },
      data: {
        status: 'RUNNING',
        totalSubsections: subsections.length,
      },
    })

    await inngest.send(
      subsections.map((item) => ({
        name: 'editorial/bulk.generate.child' as const,
        data: {
          bulkRunId,
          surgeryId,
          createdBy,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          subsection: item.subsection,
        } satisfies BulkChildPayload,
      }))
    )

    return { subsectionsEnqueued: subsections.length }
  }
)

const BULK_CHILD_CONCURRENCY = 5

/**
 * Child: runs one subsection generation, updates run counts.
 */
export const bulkGenerationChild = inngest.createFunction(
  {
    id: 'bulk-generation-child',
    concurrency: { limit: BULK_CHILD_CONCURRENCY },
    retries: 0, // Don't retry - we record as failed and continue
  },
  { event: 'editorial/bulk.generate.child' },
  async ({ event }) => {
    const { bulkRunId, surgeryId, createdBy, categoryId, categoryName, subsection } =
      event.data as BulkChildPayload

    const run = await prisma.bulkGenerationRun.findUnique({
      where: { id: bulkRunId },
      select: { status: true },
    })
    if (!run || run.status === 'CANCELLED') {
      return { skipped: true, reason: 'Run was cancelled' }
    }

    const promptText = subsection || categoryName
    const job = await prisma.dailyDoseGenerationJob.create({
      data: {
        surgeryId,
        createdBy,
        bulkRunId,
        status: 'PENDING',
        promptText,
        targetRole: 'ADMIN',
        count: 1,
        tags: [],
        interactiveFirst: true,
        categoryId,
        categoryName,
        subsection: subsection || null,
      },
    })

    try {
      await runGenerationJob(job.id)
      await prisma.$transaction(async (tx) => {
        const run = await tx.bulkGenerationRun.update({
          where: { id: bulkRunId },
          data: { completedCount: { increment: 1 } },
          select: { completedCount: true, failedCount: true, totalSubsections: true },
        })
        const done = run.completedCount + run.failedCount >= run.totalSubsections
        if (done) {
          await tx.bulkGenerationRun.update({
            where: { id: bulkRunId },
            data: { status: 'COMPLETE', completedAt: new Date() },
          })
        }
      })
      return { success: true, jobId: job.id }
    } catch (error) {
      console.error('[bulk-generation-child] Failed for subsection:', categoryName, subsection, error)
      const failedEntry = { categoryName, subsection: subsection || '(All)' }
      await prisma.$transaction(async (tx) => {
        const run = await tx.bulkGenerationRun.findUnique({
          where: { id: bulkRunId },
          select: { failedSubsections: true, completedCount: true, failedCount: true, totalSubsections: true },
        })
        if (!run) return
        const failed = Array.isArray(run.failedSubsections) ? (run.failedSubsections as object[]) : []
        await tx.bulkGenerationRun.update({
          where: { id: bulkRunId },
          data: {
            failedCount: { increment: 1 },
            failedSubsections: [...failed, failedEntry] as object[],
          },
        })
        const updated = await tx.bulkGenerationRun.findUnique({
          where: { id: bulkRunId },
          select: { completedCount: true, failedCount: true, totalSubsections: true },
        })
        if (updated && updated.completedCount + updated.failedCount >= updated.totalSubsections) {
          await tx.bulkGenerationRun.update({
            where: { id: bulkRunId },
            data: { status: 'COMPLETE', completedAt: new Date() },
          })
        }
      })
      return { success: false, jobId: job.id, error: String(error) }
    }
  }
)
