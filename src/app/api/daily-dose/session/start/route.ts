import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { DailyDoseSessionStartZ } from '@/lib/daily-dose/schemas'
import { buildQuizQuestions } from '@/lib/daily-dose/questions'
import { buildSessionQuiz } from '@/lib/daily-dose/buildSessionQuiz'
import { selectSessionCards, selectWarmupRecallCards } from '@/lib/daily-dose/sessionSelection'
import { getRecentQuestionIds } from '@/lib/daily-dose/questionExclusion'
import { extractQuestionsFromBlocks, extractQuestionsFromInteractions } from '@/lib/daily-dose/questions'
import { normaliseRoleScope, uniqueBy } from '@/lib/daily-dose/utils'
import {
  DAILY_DOSE_CARDS_PER_SESSION_DEFAULT,
  DAILY_DOSE_WARMUP_RECALL_MAX,
  DAILY_DOSE_RECENT_SESSION_EXCLUSION_WINDOW,
} from '@/lib/daily-dose/constants'
import { z } from 'zod'
import type { DailyDoseCardPayload } from '@/lib/daily-dose/types'

const MAX_INCOMPLETE_SESSION_AGE_HOURS = 8

function toCardPayload(card: {
  id: string
  title: string
  topicId: string
  topic: { name: string }
  roleScope: unknown
  contentBlocks: unknown
  interactions?: unknown
  sources: unknown
  reviewByDate: Date | null
  version: number
  status: string
  tags: unknown
  batchId?: string | null
}): DailyDoseCardPayload & { batchId?: string | null } {
  return {
    id: card.id,
    title: card.title,
    topicId: card.topicId,
    topicName: card.topic?.name,
    roleScope: normaliseRoleScope(card.roleScope),
    contentBlocks: Array.isArray(card.contentBlocks) ? (card.contentBlocks as DailyDoseCardPayload['contentBlocks']) : [],
    interactions: Array.isArray(card.interactions)
      ? (card.interactions as DailyDoseCardPayload['interactions'])
      : [],
    sources: Array.isArray(card.sources) ? (card.sources as DailyDoseCardPayload['sources']) : [],
    reviewByDate: card.reviewByDate ? card.reviewByDate.toISOString() : null,
    version: card.version,
    status: card.status,
    tags: Array.isArray(card.tags) ? (card.tags as string[]) : undefined,
    batchId: card.batchId ?? null,
  }
}

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
        where: { id: { in: storedCardIds } },
        include: { topic: true },
      })

      const cardMap = new Map(cards.map((card) => [card.id, toCardPayload(card)]))
      const orderedCards = storedCardIds.map((id) => cardMap.get(id)).filter(Boolean) as DailyDoseCardPayload[]

      if (orderedCards.length > 0) {
        const coreCard = orderedCards[0]
        const recallCards = orderedCards.slice(1)
        const quizQuestions = buildQuizQuestions({
          coreCard,
          recallCards,
          extraCards: [],
        })

        return NextResponse.json({
          sessionId: recentSession.id,
          coreCard,
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
        topicId: { in: focusTopicIds },
        OR: [{ surgeryId }, { surgeryId: null }],
      },
      include: { topic: true },
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

    // Get recent question IDs for exclusion
    const recentQuestionIds = await getRecentQuestionIds({
      userId: user.id,
      surgeryId,
      excludeLastNSessions: DAILY_DOSE_RECENT_SESSION_EXCLUSION_WINDOW,
    })

    // Build session-end quiz (primarily from session cards, max 1 recall question)
    const quizQuestions = buildSessionQuiz({
      sessionCards,
      recallCards: warmupRecallCards,
      recentQuestionIds,
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
