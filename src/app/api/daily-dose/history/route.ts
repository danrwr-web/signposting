import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { calculateStreak } from '@/lib/daily-dose/scoring'
import { DAILY_DOSE_DEFAULT_STREAK_WEEKDAY_ONLY } from '@/lib/daily-dose/constants'
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

    const profile = await prisma.dailyDoseProfile.findUnique({
      where: {
        userId_surgeryId: {
          userId: user.id,
          surgeryId,
        },
      },
    })

    const weekdayOnlyStreak =
      (profile?.preferences as { weekdayOnlyStreak?: boolean } | null)?.weekdayOnlyStreak ??
      DAILY_DOSE_DEFAULT_STREAK_WEEKDAY_ONLY

    const [sessions, totals] = await Promise.all([
      prisma.dailyDoseSession.findMany({
        where: {
          userId: user.id,
          surgeryId,
          completedAt: { not: null },
        },
        orderBy: { completedAt: 'desc' },
        take: 30,
      }),
      prisma.dailyDoseSession.aggregate({
        where: {
          userId: user.id,
          surgeryId,
          completedAt: { not: null },
        },
        _sum: { xpEarned: true },
        _count: { id: true },
      }),
    ])

    const completedDates = sessions.map((session) => session.completedAt!).filter(Boolean)
    const streak = calculateStreak(completedDates, weekdayOnlyStreak)

    const dueStates = await prisma.dailyDoseUserCardState.findMany({
      where: {
        userId: user.id,
        surgeryId,
        dueAt: { lte: new Date() },
      },
      include: {
        card: {
          include: { topic: true },
        },
      },
      orderBy: { dueAt: 'asc' },
    })

    const reviewQueue = dueStates.map((state) => ({
      cardId: state.cardId,
      title: state.card.title,
      topicName: state.card.topic?.name,
      dueAt: state.dueAt,
      box: state.box,
    }))

    return NextResponse.json({
      surgeryId,
      totalXp: totals._sum.xpEarned ?? 0,
      completedSessions: totals._count.id,
      streak,
      weekdayOnlyStreak,
      recentSessions: sessions.map((session) => ({
        id: session.id,
        completedAt: session.completedAt,
        xpEarned: session.xpEarned,
        correctCount: session.correctCount,
        questionsAttempted: session.questionsAttempted,
      })),
      reviewQueue,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('GET /api/daily-dose/history error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
