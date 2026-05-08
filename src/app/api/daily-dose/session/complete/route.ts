import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { DailyDoseSessionCompleteZ } from '@/lib/daily-dose/schemas'
import { applyReviewOutcome } from '@/lib/daily-dose/scheduler'
import { calculateAccuracy, calculateSessionXp } from '@/lib/daily-dose/scoring'
import {
  calculateAccuracyPercent,
  deriveMasteryState,
  updateProgressAccumulator,
  type LearningUnitLevel,
} from '@/lib/daily-dose/mastery'
import { z } from 'zod'

const CARD_CORRECT_THRESHOLD = 0.7
const UNKNOWN_SUBSECTION = 'Uncategorised'

type LearningAssignment = {
  categoryId: string
  subsection?: string | null
}

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

    // Collect all question IDs from this session for exclusion tracking
    const sessionQuestionIds = new Set<string>()
    parsed.cardResults.forEach((result) => {
      if (result.questionIds) {
        result.questionIds.forEach((id) => sessionQuestionIds.add(id))
      }
    })

    const cardIds = parsed.cardResults.map((result) => result.cardId)
    const cards = await prisma.dailyDoseCard.findMany({
      where: { id: { in: cardIds } },
      select: {
        id: true,
        learningCategoryId: true,
        learningSubsection: true,
        learningAssignments: true,
        unitLevel: true,
      },
    })
    const cardMap = new Map(cards.map((card) => [card.id, card]))

    const existingStates = await prisma.dailyDoseUserCardState.findMany({
      where: {
        userId: user.id,
        surgeryId,
        cardId: { in: cardIds },
      },
    })
    const stateMap = new Map(existingStates.map((state) => [state.cardId, state]))
    const now = new Date()

    const progressInputMap = new Map<
      string,
      {
        categoryId: string
        subsection: string
        unitLevel: LearningUnitLevel
        attemptedQuestions: number
        correctQuestions: number
        reinforcedAt: Date | null
      }
    >()

    for (const result of parsed.cardResults) {
      const card = cardMap.get(result.cardId)
      if (!card) continue

      const assignments = (() => {
        const list = Array.isArray(card.learningAssignments)
          ? (card.learningAssignments as LearningAssignment[])
          : []
        if (list.length > 0) return list
        if (card.learningCategoryId) {
          return [{ categoryId: card.learningCategoryId, subsection: card.learningSubsection }]
        }
        return []
      })()

      if (assignments.length === 0) continue
      const reinforcedAt = stateMap.get(result.cardId)?.lastReviewedAt ? now : null

      for (const assignment of assignments) {
        if (!assignment?.categoryId) continue
        const subsection = assignment.subsection?.trim() || card.learningSubsection?.trim() || UNKNOWN_SUBSECTION
        const key = `${assignment.categoryId}::${subsection}`
        const current = progressInputMap.get(key)
        if (!current) {
          progressInputMap.set(key, {
            categoryId: assignment.categoryId,
            subsection,
            unitLevel: card.unitLevel as LearningUnitLevel,
            attemptedQuestions: result.questionCount,
            correctQuestions: result.correctCount,
            reinforcedAt,
          })
          continue
        }
        const merged = updateProgressAccumulator({
          current,
          sessionAttemptedQuestions: result.questionCount,
          sessionCorrectQuestions: result.correctCount,
          reinforcedAt,
        })
        progressInputMap.set(key, {
          ...current,
          attemptedQuestions: merged.attemptedQuestions,
          correctQuestions: merged.correctQuestions,
          reinforcedAt: merged.reinforcedAt,
        })
      }
    }

    const categoryIds = Array.from(new Set(Array.from(progressInputMap.values()).map((v) => v.categoryId)))
    const existingProgress = categoryIds.length
      ? await prisma.userCategoryProgress.findMany({
          where: {
            userId: user.id,
            surgeryId,
            categoryId: { in: categoryIds },
          },
        })
      : []
    const progressMap = new Map(
      existingProgress.map((row) => [`${row.categoryId}::${row.subsection}`, row])
    )

    await prisma.$transaction(async (tx) => {
      await tx.dailyDoseSession.update({
        where: { id: parsed.sessionId },
        data: {
          cardResults: parsed.cardResults,
          questionIds: Array.from(sessionQuestionIds),
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

      for (const value of progressInputMap.values()) {
        const key = `${value.categoryId}::${value.subsection}`
        const existing = progressMap.get(key)

        const merged = updateProgressAccumulator({
          current: {
            attemptedQuestions: existing?.attemptedQuestions ?? 0,
            correctQuestions: existing?.correctQuestions ?? 0,
            reinforcedAt: existing?.reinforcedAt ?? null,
          },
          sessionAttemptedQuestions: value.attemptedQuestions,
          sessionCorrectQuestions: value.correctQuestions,
          reinforcedAt: value.reinforcedAt,
        })
        const accuracyPct = calculateAccuracyPercent(
          merged.correctQuestions,
          merged.attemptedQuestions
        )
        const masteryState = deriveMasteryState({
          attemptedQuestions: merged.attemptedQuestions,
          correctQuestions: merged.correctQuestions,
          reinforcedAt: merged.reinforcedAt,
        })

        await tx.userCategoryProgress.upsert({
          where: {
            userId_surgeryId_categoryId_subsection: {
              userId: user.id,
              surgeryId,
              categoryId: value.categoryId,
              subsection: value.subsection,
            },
          },
          update: {
            unitLevel: value.unitLevel,
            attemptedQuestions: merged.attemptedQuestions,
            correctQuestions: merged.correctQuestions,
            accuracyPct,
            reinforcedAt: merged.reinforcedAt,
            masteryState,
            lastActivityAt: now,
          },
          create: {
            userId: user.id,
            surgeryId,
            categoryId: value.categoryId,
            subsection: value.subsection,
            unitLevel: value.unitLevel,
            attemptedQuestions: merged.attemptedQuestions,
            correctQuestions: merged.correctQuestions,
            accuracyPct,
            reinforcedAt: merged.reinforcedAt,
            masteryState,
            lastActivityAt: now,
          },
        })
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
