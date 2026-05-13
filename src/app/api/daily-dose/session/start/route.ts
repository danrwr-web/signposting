import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { DailyDoseSessionStartZ } from '@/lib/daily-dose/schemas'
import { selectSessionCards, selectWarmupRecallCards } from '@/lib/daily-dose/sessionSelection'
import { extractQuestionsFromBlocks, extractQuestionsFromInteractions } from '@/lib/daily-dose/questions'
import { normaliseRoleScope, uniqueBy, toCardPayload } from '@/lib/daily-dose/utils'
import {
  DAILY_DOSE_CARDS_PER_SESSION_DEFAULT,
  DAILY_DOSE_WARMUP_RECALL_MAX,
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
        const sessionCards = orderedCards
        const warmupQuestions: DailyDoseQuizQuestion[] = []

        return NextResponse.json({
          sessionId: recentSession.id,
          sessionCards,
          warmupQuestions,
          quizQuestions: [],
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
        learningAssignments: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Apply role scope filter on raw cards first so we can also apply category filter
    // before converting to payloads (learningAssignments is not in the payload type).
    const roleScopedCards = cards.filter((card) => {
      const scope = normaliseRoleScope(card.roleScope)
      return scope.length === 0 ? true : scope.includes(role)
    })

    // If a specific learning category was requested, restrict to matching cards.
    // Fall back to the full role-scoped set if no cards match (avoids an empty session).
    const filteredRawCards = (() => {
      if (!parsed.categoryId) return roleScopedCards
      const categoryFiltered = roleScopedCards.filter((card) => {
        const assignments = Array.isArray(card.learningAssignments)
          ? (card.learningAssignments as Array<{ categoryId: string }>)
          : []
        return assignments.some((a) => a.categoryId === parsed.categoryId)
      })
      return categoryFiltered.length > 0 ? categoryFiltered : roleScopedCards
    })()

    let eligibleCards = filteredRawCards.map((card) => toCardPayload(card))

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

    // Prevent same-session repetition by excluding warm-up cards from the learning block pool.
    const warmupCardIds = new Set(warmupRecallCards.map((card) => card.id))
    const mainEligibleCards = eligibleCards.filter((card) => !warmupCardIds.has(card.id))

    // Select 3-5 cards for the learning block (prefer same batch/learning unit)
    const sessionCards = selectSessionCards({
      eligibleCards: mainEligibleCards.length > 0 ? mainEligibleCards : eligibleCards,
      cardStates: stateMap,
      targetCount: DAILY_DOSE_CARDS_PER_SESSION_DEFAULT,
      now,
    })

    if (sessionCards.length === 0) {
      return NextResponse.json({ error: 'No Daily Dose cards available for this role yet' }, { status: 404 })
    }

    // Collect all card IDs for session tracking
    const sessionCardIds = uniqueBy(
      [
        ...sessionCards.map((card) => card.id),
        ...warmupRecallCards.map((card) => card.id),
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
      sessionCards,
      warmupQuestions,
      quizQuestions: [],
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
