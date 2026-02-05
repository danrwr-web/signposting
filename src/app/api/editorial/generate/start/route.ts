import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { EditorialGenerateRequestZ } from '@/lib/schemas/editorial'
import { resolveTargetRole } from '@/lib/editorial/roleRouting'
import { runGenerationJob } from '@/server/editorial/runGenerationJob'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Start returns quickly; background job runs up to platform limit

const MAX_GENERATIONS_PER_HOUR = 5

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = EditorialGenerateRequestZ.parse(body)
    const surgeryId = resolveSurgeryIdForUser({ requestedId: parsed.surgeryId, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    // Rate limit: batches in last hour + pending/running jobs
    const since = new Date(Date.now() - 60 * 60 * 1000)
    const [batchCount, jobCount] = await Promise.all([
      prisma.dailyDoseGenerationBatch.count({
        where: { createdBy: user.id, createdAt: { gte: since } },
      }),
      prisma.dailyDoseGenerationJob.count({
        where: {
          createdBy: user.id,
          status: { in: ['PENDING', 'RUNNING'] },
        },
      }),
    ])
    if (batchCount + jobCount >= MAX_GENERATIONS_PER_HOUR) {
      return NextResponse.json(
        { ok: false, error: { code: 'RATE_LIMITED', message: 'Generation limit reached. Try again later.' } },
        { status: 429 }
      )
    }

    const resolvedRole = resolveTargetRole({
      promptText: parsed.promptText,
      requestedRole: parsed.targetRole,
    })

    const job = await prisma.dailyDoseGenerationJob.create({
      data: {
        surgeryId,
        createdBy: user.id,
        status: 'PENDING',
        promptText: parsed.promptText,
        targetRole: resolvedRole,
        count: parsed.count,
        tags: parsed.tags ?? [],
        interactiveFirst: parsed.interactiveFirst,
      },
    })

    after(async () => {
      await runGenerationJob(job.id)
    })

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      message: 'Generation started. You can continue reviewing cards. We will notify you when ready.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 }
      )
    }
    console.error('POST /api/editorial/generate/start error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
