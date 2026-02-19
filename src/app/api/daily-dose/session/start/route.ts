import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { DailyDoseSessionStartZ } from '@/lib/daily-dose/schemas'
import { buildSessionQuiz } from '@/lib/daily-dose/buildSessionQuiz'
import { selectSessionCards, selectWarmupRecallCards } from '@/lib/daily-dose/sessionSelection'
import { getRecentQuestionIds, getCardsFromRecentSessions } from '@/lib/daily-dose/questionExclusion'
import { extractQuestionsFromBlocks, extractQuestionsFromInteractions } from '@/lib/daily-dose/questions'
import { normaliseRoleScope, uniqueBy, toCardPayload } from '@/lib/daily-dose/utils'
import {
  DAILY_DOSE_CARDS_PER_SESSION_DEFAULT,
  DAILY_DOSE_WARMUP_RECALL_MAX,
  DAILY_DOSE_QUIZ_LENGTH_DEFAULT,
  QUIZ_EXCLUSION_SESSIONS,
} from '@/lib/daily-dose/constants'
import { z } from 'zod'
import type { DailyDoseCardPayload, DailyDoseQuizQuestion } from '@/lib/daily-dose/types'

const MAX_INCOMPLETE_SESSION_AGE_HOURS = 8

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = DailyDoseSessionStartZ.parse(body)
    const surgeryId = resolveSurgeryIdForUser({ requestedId: parsed.surgeryId, user })
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

    if (!profile || !profile.onboardingCompleted) {
      return NextResponse.json({ error: 'Daily Dose onboarding required' }, { status: 409 })
    }

    const now = new Date()
    const recentSession = await prisma.dailyDoseSession.findFirst({
      where: {
        userId: user.id,
        surgeryId,
        completedAt: null,
        createdAt: {
          gte: new Date(now.getTime() - MAX_INCOMPLETE_SESSION_AGE_HOURS * 60 * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (recentSession) {
      const storedCardIds = Array.isArray(recentSession.cardIds)
        ? (recentSession.cardIds as string[])
        : []
        const cards = await prisma.dailyDoseCard.findMany({
          where: { 
            id: { in: storedCardIds },
            isActive: true,
          },
          select: {
          id: true,
          title: true,
          topicId: true,
          topic: { select: { name: true } },
          roleScope: true,
          contentBlocks: true,
          interactions: true,
          sources: true,
          reviewByDate: true,
          version: true,
          status: true,
          tags: true,
          batchId: true,
        },
      })

      const cardMap = new Map(cards.map((card) => [card.id, toCardPayload(card)]))
      const orderedCards = storedCardIds.map((id) => cardMap.get(id)).filter(Boolean) as DailyDoseCardPayload[]

      if (orderedCards.length > 0) {
        // For resumed sessions, treat all cards as session cards
        const sessionCards = orderedCards
        const warmupQuestions: DailyDoseQuizQuestion[] = []
        
        const recentSessionCards = await getCardsFromRecentSessions({
          userId: user.id,
          surgeryId,
        })
        const excludeQuestionIds = await getRecentQuestionIds({
          userId: user.id,
          surgeryId,
          excludeLastNSessions: QUIZ_EXCLUSION_SESSIONS,
        })

        const quizQuestions = buildSessionQuiz({
          sessionCards,
          recentSessionCards,
          recallCards: [],
          excludeQuestionIds,
          targetLength: DAILY_DOSE_QUIZ_LENGTH_DEFAULT,
        })

        return NextResponse.json({
          sessionId: recentSession.id,
          sessionCards,
          warmupQuestions,
          quizQuestions,
          resumed: true,
        })
      }
    }

    const preferences = (profile.preferences as { chosenFocusTopicIds?: string[] } | null) ?? null

    const topics = await prisma.dailyDoseTopic.findMany({
      where: {
        isActive: true,
        OR: [{ surgeryId }, { surgeryId: null }],
      },
      orderBy: [{ ordering: 'asc' }, { name: 'asc' }],
    })

    const role = profile.role
    const eligibleTopics = topics.filter((topic) => {
      const scope = normaliseRoleScope(topic.roleScope)
      return scope.length === 0 ? true : scope.includes(role)
    })

    const focusIds = preferences?.chosenFocusTopicIds ?? []
    const focusTopicIds = focusIds.length
      ? eligibleTopics.filter((topic) => focusIds.includes(topic.id)).map((topic) => topic.id)
      : eligibleTopics.map((topic) => topic.id)

    if (focusTopicIds.length === 0) {
      return NextResponse.json(
        { error: 'No Daily Dose topics available for this role yet' },
        { status: 404 }
      )
    }

    const cards = await prisma.dailyDoseCard.findMany({
      where: {
        status: 'PUBLISHED',
        isActive: true,
        topicId: { in: focusTopicIds },
        OR: [{ surgeryId }, { surgeryId: null }],
      },
      select: {
        id: true,
        title: true,
        topicId: true,
        topic: { select: { name: true } },
        roleScope: true,
        contentBlocks: true,
        interactions: true,
        sources: true,
        reviewByDate: true,
        version: true,
        status: true,
        tags: true,
        batchId: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    const eligibleCards = cards
      .map((card) => toCardPayload(card))
      .filter((card) => {
        const scope = card.roleScope
        return scope.length === 0 ? true : scope.includes(role)
      })

    if (eligibleCards.length === 0) {
      return NextResponse.json(
        { error: 'No Daily Dose cards available for this role yet' },
        { status: 404 }
      )
    }

    const cardStates = await prisma.dailyDoseUserCardState.findMany({
      where: { userId: user.id, surgeryId },
      select: { cardId: true, dueAt: true, incorrectStreak: true, lastReviewedAt: true },
    })

    // Build state map with proper Date objects
    const stateMap = new Map(
      cardStates.map((state) => [
        state.cardId,
        {
          dueAt: state.dueAt,
          incorrectStreak: state.incorrectStreak,
          lastReviewedAt: state.lastReviewedAt,
        },
      ])
    )

    // Select warm-up recall cards (0-2 questions at start)
    const warmupRecallCards = selectWarmupRecallCards({
      eligibleCards,
      cardStates: stateMap,
      maxCount: DAILY_DOSE_WARMUP_RECALL_MAX,
      now,
    })

    // Select 3-5 cards for the learning block (prefer same batch/learning unit)
    const sessionCards = selectSessionCards({
      eligibleCards,
      cardStates: stateMap,
      targetCount: DAILY_DOSE_CARDS_PER_SESSION_DEFAULT,
      now,
    })

    if (sessionCards.length === 0) {
      return NextResponse.json({ error: 'No Daily Dose cards available for this role yet' }, { status: 404 })
    }

    const recentSessionCards = await getCardsFromRecentSessions({
      userId: user.id,
      surgeryId,
    })
    const excludeQuestionIds = await getRecentQuestionIds({
      userId: user.id,
      surgeryId,
      excludeLastNSessions: QUIZ_EXCLUSION_SESSIONS,
    })

    const quizQuestions = buildSessionQuiz({
      sessionCards,
      recentSessionCards,
      recallCards: warmupRecallCards,
      excludeQuestionIds,
      targetLength: DAILY_DOSE_QUIZ_LENGTH_DEFAULT,
    })

    // Collect all card IDs for session tracking
    const sessionCardIds = uniqueBy(
      [
        ...sessionCards.map((card) => card.id),
        ...warmupRecallCards.map((card) => card.id),
        ...quizQuestions.map((question) => question.cardId),
      ],
      (value) => value
    )

    const session = await prisma.dailyDoseSession.create({
      data: {
        userId: user.id,
        surgeryId,
        cardIds: sessionCardIds,
      },
    })

    // Extract warm-up questions from warm-up recall cards
    const warmupQuestions: DailyDoseQuizQuestion[] = []
    for (const card of warmupRecallCards) {
      const questions = [
        ...extractQuestionsFromBlocks(card),
        ...extractQuestionsFromInteractions(card),
      ]
      if (questions.length > 0) {
        warmupQuestions.push({
          ...questions[0],
          order: warmupQuestions.length + 1,
        })
      }
    }

    return NextResponse.json({
      sessionId: session.id,
      sessionCards, // Multiple cards for learning block
      warmupQuestions, // 0-2 questions for warm-up recall
      quizQuestions, // Session-end quiz
      resumed: false,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('POST /api/daily-dose/session/start error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
