import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/editorial/bulk-generate/cancel
 * Cancels a running bulk generation. Child jobs that haven't started will exit early.
 * Body: { bulkRunId: string } or bulkRunId in query.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    let bulkRunId: string | null = null
    try {
      const body = await request.json().catch(() => ({}))
      bulkRunId = body.bulkRunId ?? new URL(request.url).searchParams.get('bulkRunId')
    } catch {
      bulkRunId = new URL(request.url).searchParams.get('bulkRunId')
    }

    if (!bulkRunId) {
      return NextResponse.json(
        { ok: false, error: 'bulkRunId is required' },
        { status: 400 }
      )
    }

    const run = await prisma.bulkGenerationRun.findUnique({
      where: { id: bulkRunId },
      select: { id: true, surgeryId: true, status: true },
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

    if (run.status !== 'RUNNING' && run.status !== 'PENDING') {
      return NextResponse.json({
        ok: true,
        message: 'Run is already finished or cancelled',
        status: run.status,
      })
    }

    await prisma.bulkGenerationRun.update({
      where: { id: bulkRunId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    })

    return NextResponse.json({
      ok: true,
      bulkRunId,
      status: 'CANCELLED',
      message: 'Bulk generation cancelled. Jobs in progress will finish; remaining jobs will not run.',
    })
  } catch (error) {
    console.error('POST /api/editorial/bulk-generate/cancel error', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
