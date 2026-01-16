import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { DailyDoseSurgeryQueryZ } from '@/lib/daily-dose/schemas'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const query = DailyDoseSurgeryQueryZ.parse({
      surgeryId: request.nextUrl.searchParams.get('surgeryId') ?? undefined,
    })
    const surgeryId = resolveSurgeryIdForUser({ requestedId: query.surgeryId, user })
    if (!surgeryId) {
      return NextResponse.json({ error: 'Surgery access required' }, { status: 403 })
    }

    const now = new Date()
    const dueStates = await prisma.dailyDoseUserCardState.findMany({
      where: {
        userId: user.id,
        surgeryId,
        dueAt: { lte: now },
      },
      include: {
        card: {
          include: { topic: true },
        },
      },
      orderBy: { dueAt: 'asc' },
    })

    const items = dueStates.map((state) => ({
      cardId: state.cardId,
      title: state.card.title,
      topicName: state.card.topic?.name,
      dueAt: state.dueAt,
      box: state.box,
    }))

    return NextResponse.json({
      dueCount: items.length,
      items,
      surgeryId,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('GET /api/daily-dose/reviews error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
