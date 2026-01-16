import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { DailyDoseSessionStartZ } from '@/lib/daily-dose/schemas'
import { buildQuizQuestions } from '@/lib/daily-dose/questions'
import { pickCoreCard } from '@/lib/daily-dose/selection'
import { normaliseRoleScope, uniqueBy } from '@/lib/daily-dose/utils'
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
  sources: unknown
  reviewByDate: Date | null
  version: number
  status: string
  tags: unknown
}): DailyDoseCardPayload {
  return {
    id: card.id,
    title: card.title,
    topicId: card.topicId,
    topicName: card.topic?.name,
    roleScope: normaliseRoleScope(card.roleScope),
    contentBlocks: Array.isArray(card.contentBlocks) ? (card.contentBlocks as DailyDoseCardPayload['contentBlocks']) : [],
    sources: Array.isArray(card.sources) ? (card.sources as DailyDoseCardPayload['sources']) : [],
    reviewByDate: card.reviewByDate ? card.reviewByDate.toISOString() : null,
    version: card.version,
    status: card.status,
    tags: Array.isArray(card.tags) ? (card.tags as string[]) : undefined,
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
      select: { cardId: true, dueAt: true },
    })

    const stateMap = new Map(cardStates.map((state) => [state.cardId, state]))
    const dueCards = eligibleCards
      .filter((card) => {
        const state = stateMap.get(card.id)
        return state ? state.dueAt <= now : false
      })
      .sort((a, b) => {
        const aDue = stateMap.get(a.id)?.dueAt?.getTime() ?? 0
        const bDue = stateMap.get(b.id)?.dueAt?.getTime() ?? 0
        return aDue - bDue
      })

    const newCards = eligibleCards.filter((card) => !stateMap.has(card.id))

    const coreCard = pickCoreCard({ dueCards, newCards })
    if (!coreCard) {
      return NextResponse.json({ error: 'No Daily Dose cards are ready yet' }, { status: 404 })
    }

    const recallCards = dueCards.filter((card) => card.id !== coreCard.id).slice(0, 2)
    const extraCards = eligibleCards.filter(
      (card) => card.id !== coreCard.id && !recallCards.some((recall) => recall.id === card.id)
    )

    const quizQuestions = buildQuizQuestions({
      coreCard,
      recallCards,
      extraCards,
    })

    const sessionCardIds = uniqueBy(
      [coreCard.id, ...quizQuestions.map((question) => question.cardId)],
      (value) => value
    )

    const session = await prisma.dailyDoseSession.create({
      data: {
        userId: user.id,
        surgeryId,
        cardIds: sessionCardIds,
      },
    })

    return NextResponse.json({
      sessionId: session.id,
      coreCard,
      quizQuestions,
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
