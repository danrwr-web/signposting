import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { DailyDoseSessionCompleteZ } from '@/lib/daily-dose/schemas'
import { applyReviewOutcome } from '@/lib/daily-dose/scheduler'
import { calculateAccuracy, calculateSessionXp } from '@/lib/daily-dose/scoring'
import { z } from 'zod'

const CARD_CORRECT_THRESHOLD = 0.7

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = DailyDoseSessionCompleteZ.parse(body)
    const surgeryId = resolveSurgeryIdForUser({ requestedId: parsed.surgeryId, user })
    if (!surgeryId) {
      return NextResponse.json({ error: 'Surgery access required' }, { status: 403 })
    }

    const session = await prisma.dailyDoseSession.findFirst({
      where: {
        id: parsed.sessionId,
        userId: user.id,
        surgeryId,
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.completedAt) {
      return NextResponse.json({ error: 'Session already completed' }, { status: 409 })
    }

    const questionCount = parsed.cardResults.reduce((total, result) => total + result.questionCount, 0)
    const correctCount = parsed.cardResults.reduce((total, result) => total + result.correctCount, 0)
    const xpEarned = calculateSessionXp({
      correctCount,
      questionsAttempted: questionCount,
    })

    const cardIds = parsed.cardResults.map((result) => result.cardId)
    const existingStates = await prisma.dailyDoseUserCardState.findMany({
      where: {
        userId: user.id,
        surgeryId,
        cardId: { in: cardIds },
      },
    })
    const stateMap = new Map(existingStates.map((state) => [state.cardId, state]))
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      await tx.dailyDoseSession.update({
        where: { id: parsed.sessionId },
        data: {
          cardResults: parsed.cardResults,
          questionsAttempted: questionCount,
          correctCount,
          xpEarned,
          completedAt: now,
        },
      })

      for (const result of parsed.cardResults) {
        const accuracy = calculateAccuracy(result.correctCount, result.questionCount)
        const isCorrect = result.questionCount > 0 && accuracy >= CARD_CORRECT_THRESHOLD
        const existing = stateMap.get(result.cardId)
        const next = applyReviewOutcome({
          currentBox: existing?.box ?? 1,
          correct: isCorrect,
          now,
          correctStreak: existing?.correctStreak ?? 0,
          incorrectStreak: existing?.incorrectStreak ?? 0,
        })

        if (existing) {
          await tx.dailyDoseUserCardState.update({
            where: { id: existing.id },
            data: {
              box: next.box,
              intervalDays: next.intervalDays,
              dueAt: next.dueAt,
              lastReviewedAt: now,
              correctStreak: next.correctStreak,
              incorrectStreak: next.incorrectStreak,
            },
          })
        } else {
          await tx.dailyDoseUserCardState.create({
            data: {
              userId: user.id,
              surgeryId,
              cardId: result.cardId,
              box: next.box,
              intervalDays: next.intervalDays,
              dueAt: next.dueAt,
              lastReviewedAt: now,
              correctStreak: next.correctStreak,
              incorrectStreak: next.incorrectStreak,
            },
          })
        }
      }
    })

    return NextResponse.json({
      sessionId: parsed.sessionId,
      xpEarned,
      correctCount,
      questionsAttempted: questionCount,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('POST /api/daily-dose/session/complete error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
