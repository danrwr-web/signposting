import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const JobIdZ = z.object({ jobId: z.string().min(1) })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { jobId } = JobIdZ.parse({ jobId: (await params).jobId })

    const job = await prisma.dailyDoseGenerationJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        surgeryId: true,
        createdBy: true,
        status: true,
        batchId: true,
        errorMessage: true,
      },
    })

    if (!job) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Job not found' } },
        { status: 404 }
      )
    }

    const surgeryId = resolveSurgeryIdForUser({ requestedId: job.surgeryId, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      )
    }

    return NextResponse.json({
      ok: true,
      status: job.status,
      batchId: job.batchId,
      errorMessage: job.errorMessage,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid job ID' } },
        { status: 400 }
      )
    }
    console.error('GET /api/editorial/generate/status/[jobId] error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
