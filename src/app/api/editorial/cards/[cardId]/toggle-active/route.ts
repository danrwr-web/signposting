import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { z } from 'zod'

const ToggleActiveZ = z.object({
  surgeryId: z.string().optional(),
  isActive: z.boolean(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { cardId: string } }
) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = ToggleActiveZ.parse(body)
    const surgeryId = resolveSurgeryIdForUser({ requestedId: parsed.surgeryId, user })

    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const card = await prisma.dailyDoseCard.findFirst({
      where: {
        id: params.cardId,
        surgeryId,
      },
    })

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    await prisma.dailyDoseCard.update({
      where: { id: params.cardId },
      data: { isActive: parsed.isActive },
    })

    return NextResponse.json({ success: true, isActive: parsed.isActive })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('POST /api/editorial/cards/[cardId]/toggle-active error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
