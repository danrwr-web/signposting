import 'server-only'

import { NextRequest, NextResponse, after } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { prisma } from '@/lib/prisma'
import { runBulkGeneration } from '@/server/editorial/runBulkGeneration'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/editorial/bulk-generate/status?bulkRunId=xxx
 * Returns progress for a bulk generation run.
 *
 * Also acts as the continuation driver: if the run is RUNNING and there
 * are PENDING jobs with no currently-RUNNING job (meaning the previous
 * worker's time budget expired), it kicks off another batch via after().
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const bulkRunId = searchParams.get('bulkRunId')
    if (!bulkRunId) {
      return NextResponse.json(
        { ok: false, error: 'bulkRunId is required' },
        { status: 400 }
      )
    }

    const run = await prisma.bulkGenerationRun.findUnique({
      where: { id: bulkRunId },
      select: {
        id: true,
        surgeryId: true,
        status: true,
        totalSubsections: true,
        completedCount: true,
        failedCount: true,
        failedSubsections: true,
        createdAt: true,
        completedAt: true,
      },
    })

    if (!run) {
      return NextResponse.json(
        { ok: false, error: 'Bulk run not found' },
        { status: 404 }
      )
    }

    const surgeryId = resolveSurgeryIdForUser({
      requestedId: run.surgeryId,
      user,
    })
    if (!surgeryId || run.surgeryId !== surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { ok: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // Continuation: if run is RUNNING and no worker is active, resume
    if (run.status === 'RUNNING') {
      const [pendingCount, runningCount] = await Promise.all([
        prisma.dailyDoseGenerationJob.count({
          where: { bulkRunId, status: 'PENDING' },
        }),
        prisma.dailyDoseGenerationJob.count({
          where: { bulkRunId, status: 'RUNNING' },
        }),
      ])
      if (pendingCount > 0 && runningCount === 0) {
        after(async () => {
          await runBulkGeneration(bulkRunId)
        })
      }
    }

    const failedSubsections = Array.isArray(run.failedSubsections)
      ? (run.failedSubsections as Array<{ categoryName: string; subsection: string }>)
      : []

    return NextResponse.json({
      ok: true,
      bulkRunId: run.id,
      status: run.status,
      totalSubsections: run.totalSubsections,
      completedCount: run.completedCount,
      failedCount: run.failedCount,
      failedSubsections,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
    })
  } catch (error) {
    console.error('GET /api/editorial/bulk-generate/status error', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
