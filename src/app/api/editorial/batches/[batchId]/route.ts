import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ batchId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { batchId } = await params
    const surgeryIdParam = request.nextUrl.searchParams.get('surgeryId') ?? undefined
    const surgeryId = resolveSurgeryIdForUser({ requestedId: surgeryIdParam, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const batch = await prisma.dailyDoseGenerationBatch.findFirst({
      where: { id: batchId, surgeryId },
      include: {
        cards: { orderBy: { createdAt: 'asc' } },
        quiz: true,
      },
    })

    if (!batch) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Batch not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      batch: {
        id: batch.id,
        promptText: batch.promptText,
        targetRole: batch.targetRole,
        modelUsed: batch.modelUsed,
        createdAt: batch.createdAt,
      },
      cards: batch.cards,
      quiz: batch.quiz,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 }
      )
    }
    console.error('GET /api/editorial/batches/[batchId] error', error)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
