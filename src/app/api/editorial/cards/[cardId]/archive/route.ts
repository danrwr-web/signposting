import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ cardId: string }>
}

const ArchiveRequestZ = z.object({
  surgeryId: z.string().optional(),
})

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { cardId } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = ArchiveRequestZ.parse({
      surgeryId: request.nextUrl.searchParams.get('surgeryId') ?? body?.surgeryId,
    })

    const surgeryId = resolveSurgeryIdForUser({ requestedId: parsed.surgeryId, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const card = await prisma.dailyDoseCard.findFirst({
      where: { id: cardId, surgeryId },
    })
    if (!card) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Card not found' } },
        { status: 404 }
      )
    }

    if (card.status === 'ARCHIVED') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATE', message: 'Card is already archived' } },
        { status: 409 }
      )
    }

    const archived = await prisma.dailyDoseCard.update({
      where: { id: card.id },
      data: {
        status: 'ARCHIVED',
      },
    })

    return NextResponse.json({ cardId: archived.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 }
      )
    }
    console.error('POST /api/editorial/cards/[cardId]/archive error', error)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
