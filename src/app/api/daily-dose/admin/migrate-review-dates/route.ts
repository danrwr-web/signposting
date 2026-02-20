import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { DailyDoseSurgeryQueryZ } from '@/lib/daily-dose/schemas'
import { z } from 'zod'

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (user.globalRole !== 'SUPERUSER') {
      return NextResponse.json({ error: 'Superuser access required' }, { status: 403 })
    }

    const query = DailyDoseSurgeryQueryZ.parse({
      surgeryId: request.nextUrl.searchParams.get('surgeryId') ?? undefined,
    })
    const surgeryId = resolveSurgeryIdForUser({ requestedId: query.surgeryId, user })
    if (!surgeryId) {
      return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
    }

    const now = new Date()
    const cards = await prisma.dailyDoseCard.findMany({
      where: {
        OR: [{ surgeryId }, { surgeryId: null }],
      },
      select: {
        id: true,
        reviewByDate: true,
        createdAt: true,
      },
    })

    const updates = cards
      .filter((card) => {
        if (!card.reviewByDate) return false
        const reviewDate = new Date(card.reviewByDate)
        return !Number.isNaN(reviewDate.getTime()) && reviewDate <= now
      })
      .map((card) => {
        const createdAt = new Date(card.createdAt)
        const newReviewByDate = new Date(createdAt.getTime() + 180 * 24 * 60 * 60 * 1000) // 6 months from creation
        return prisma.dailyDoseCard.update({
          where: { id: card.id },
          data: { reviewByDate: newReviewByDate },
        })
      })

    const results = await prisma.$transaction(updates)

    return NextResponse.json({
      updated: results.length,
      total: cards.length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('POST /api/daily-dose/admin/migrate-review-dates error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
