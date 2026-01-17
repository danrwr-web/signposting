import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { DailyDoseFlagInputZ } from '@/lib/daily-dose/schemas'
import { z } from 'zod'

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = DailyDoseFlagInputZ.parse(body)
    const surgeryId = resolveSurgeryIdForUser({ requestedId: parsed.surgeryId, user })
    if (!surgeryId) {
      return NextResponse.json({ error: 'Surgery access required' }, { status: 403 })
    }

    const card = await prisma.dailyDoseCard.findFirst({
      where: {
        id: parsed.cardId,
        OR: [{ surgeryId }, { surgeryId: null }],
      },
      select: { id: true },
    })

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    const flag = await prisma.dailyDoseFlaggedContent.create({
      data: {
        userId: user.id,
        cardId: parsed.cardId,
        surgeryId,
        reason: parsed.reason,
        freeText: parsed.freeText?.trim() || null,
      },
    })

    return NextResponse.json({ flag }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('POST /api/daily-dose/flags error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
