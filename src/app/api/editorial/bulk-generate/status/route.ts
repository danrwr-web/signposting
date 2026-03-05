import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/editorial/bulk-generate/status?bulkRunId=xxx
 * Returns progress for a bulk generation run.
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
