import 'server-only'

import { prisma } from '@/lib/prisma'
import { runGenerationJob } from '@/server/editorial/runGenerationJob'

/** Process this many subsections per chunk (~4 min at ~40s each + 2s throttle). */
const CHUNK_SIZE = 6
const THROTTLE_MS = 2_000

function buildSubsectionsList(
  categories: Array<{ id: string; name: string; subsections: unknown }>
): Array<{ categoryId: string; categoryName: string; subsection: string }> {
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
  return subsections
}

/**
 * Process one chunk of bulk generation. On completion, if more subsections
 * remain and run is not cancelled, invokes the continue endpoint to process the next chunk.
 * @param baseUrl - Origin of the app (e.g. https://app.vercel.app) for self-invocation. If omitted, uses VERCEL_URL or NEXTAUTH_URL.
 */
export async function runBulkGenerationChunk(
  bulkRunId: string,
  baseUrl?: string
): Promise<void> {
  try {
    const run = await prisma.bulkGenerationRun.findUnique({
      where: { id: bulkRunId },
      select: {
        id: true,
        surgeryId: true,
        createdBy: true,
        targetRole: true,
        status: true,
        totalSubsections: true,
        completedCount: true,
        failedCount: true,
      },
    })
    if (!run || run.status === 'CANCELLED') return

    const targetRole = (run.targetRole === 'GP' || run.targetRole === 'NURSE') ? run.targetRole : 'ADMIN'

    // Build flat list of subsections
    const categories = await prisma.learningCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, subsections: true },
      orderBy: { ordering: 'asc' },
    })
    const allSubsections = buildSubsectionsList(categories)

    // Subsections already attempted this run (from jobs)
    const attemptedJobs = await prisma.dailyDoseGenerationJob.findMany({
      where: { bulkRunId },
      select: { categoryId: true, subsection: true },
    })
    const attemptedKey = (cid: string, sub: string) => `${cid}::${sub}`
    const attemptedSet = new Set(attemptedJobs.map((j) => attemptedKey(j.categoryId ?? '', j.subsection ?? '')))

    // Card count per (categoryId, subsection) for this surgery + role
    const cards = await prisma.dailyDoseCard.findMany({
      where: { surgeryId: run.surgeryId, targetRole, isActive: true },
      select: { learningAssignments: true },
    })
    const countMap = new Map<string, number>()
    for (const card of cards) {
      const assignments = Array.isArray(card.learningAssignments) ? card.learningAssignments as Array<{ categoryId?: string; subsection?: string | null }> : []
      for (const a of assignments) {
        if (!a?.categoryId) continue
        const key = attemptedKey(a.categoryId, a.subsection ?? '')
        countMap.set(key, (countMap.get(key) ?? 0) + 1)
      }
    }

    // Filter to not-yet-attempted and sort by count ascending (prioritise gaps)
    const remaining = allSubsections
      .filter((s) => !attemptedSet.has(attemptedKey(s.categoryId, s.subsection)))
      .sort((a, b) => {
        const countA = countMap.get(attemptedKey(a.categoryId, a.subsection)) ?? 0
        const countB = countMap.get(attemptedKey(b.categoryId, b.subsection)) ?? 0
        return countA - countB
      })

    const totalSubsections = allSubsections.length
    const chunk = remaining.slice(0, CHUNK_SIZE)

    // First chunk: set total and status
    if (run.totalSubsections === 0) {
      await prisma.bulkGenerationRun.update({
        where: { id: bulkRunId },
        data: { status: 'RUNNING', totalSubsections },
      })
    }

    // No remaining subsections to process this run
    if (chunk.length === 0) {
      await prisma.bulkGenerationRun.update({
        where: { id: bulkRunId },
        data: { status: 'COMPLETE', completedAt: new Date() },
      })
      return
    }

    for (let i = 0; i < chunk.length; i++) {
      const item = chunk[i]
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS))
      }

      const currentRun = await prisma.bulkGenerationRun.findUnique({
        where: { id: bulkRunId },
        select: { status: true },
      })
      if (!currentRun || currentRun.status === 'CANCELLED') return

      const promptText = item.subsection || item.categoryName
      const job = await prisma.dailyDoseGenerationJob.create({
        data: {
          surgeryId: run.surgeryId,
          createdBy: run.createdBy,
          bulkRunId,
          status: 'PENDING',
          promptText,
          targetRole,
          count: 1,
          tags: [],
          interactiveFirst: true,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          subsection: item.subsection || null,
        },
      })

      try {
        await runGenerationJob(job.id)
      } catch (error) {
        console.error(
          '[runBulkGenerationChunk] runGenerationJob threw for subsection:',
          item.categoryName,
          item.subsection,
          error
        )
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
          if (
            updated.completedCount + updated.failedCount >= updated.totalSubsections
          ) {
            await tx.bulkGenerationRun.update({
              where: { id: bulkRunId },
              data: { status: 'COMPLETE', completedAt: new Date() },
            })
          }
        })
      } else {
        const failedEntry = {
          categoryName: item.categoryName,
          subsection: item.subsection || '(All)',
        }
        await prisma.$transaction(async (tx) => {
          const current = await tx.bulkGenerationRun.findUnique({
            where: { id: bulkRunId },
            select: {
              failedSubsections: true,
              completedCount: true,
              failedCount: true,
              totalSubsections: true,
            },
          })
          if (!current) return
          const failed = Array.isArray(current.failedSubsections)
            ? (current.failedSubsections as object[])
            : []
          await tx.bulkGenerationRun.update({
            where: { id: bulkRunId },
            data: {
              failedCount: { increment: 1 },
              failedSubsections: [...failed, failedEntry] as object[],
            },
          })
          const afterUpdate = await tx.bulkGenerationRun.findUnique({
            where: { id: bulkRunId },
            select: {
              completedCount: true,
              failedCount: true,
              totalSubsections: true,
            },
          })
          if (
            afterUpdate &&
            afterUpdate.completedCount + afterUpdate.failedCount >=
              afterUpdate.totalSubsections
          ) {
            await tx.bulkGenerationRun.update({
              where: { id: bulkRunId },
              data: { status: 'COMPLETE', completedAt: new Date() },
            })
          }
        })
      }
    }

    // More subsections remain and not cancelled? Invoke continue endpoint
    const finalRun = await prisma.bulkGenerationRun.findUnique({
      where: { id: bulkRunId },
      select: { status: true, completedCount: true, failedCount: true, totalSubsections: true },
    })
    if (
      finalRun &&
      finalRun.status === 'RUNNING' &&
      finalRun.completedCount + finalRun.failedCount < finalRun.totalSubsections
    ) {
      await invokeBulkContinue(bulkRunId, baseUrl)
    } else if (
      finalRun &&
      finalRun.status === 'RUNNING' &&
      finalRun.completedCount + finalRun.failedCount >= finalRun.totalSubsections
    ) {
      await prisma.bulkGenerationRun.update({
        where: { id: bulkRunId },
        data: { status: 'COMPLETE', completedAt: new Date() },
      })
    }
  } catch (outerError) {
    console.error('[runBulkGenerationChunk] Unexpected error for run:', bulkRunId, outerError)
    try {
      await prisma.bulkGenerationRun.update({
        where: { id: bulkRunId },
        data: { status: 'COMPLETE', completedAt: new Date() },
      })
    } catch {
      // ignore
    }
  }
}

/** Call the bulk-generate/continue endpoint to process the next chunk. */
async function invokeBulkContinue(bulkRunId: string, baseUrl?: string): Promise<void> {
  const base =
    baseUrl ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    process.env.NEXTAUTH_URL ??
    'http://localhost:3000'
  const url = `${base.replace(/\/$/, '')}/api/editorial/bulk-generate/continue`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulkRunId }),
    })
    if (!res.ok) {
      console.error('[runBulkGenerationChunk] Continue request failed:', res.status, await res.text())
    }
  } catch (err) {
    console.error('[runBulkGenerationChunk] Failed to invoke continue:', err)
  }
}
