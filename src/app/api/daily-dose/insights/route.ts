import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { DailyDoseSurgeryQueryZ } from '@/lib/daily-dose/schemas'
import { z } from 'zod'

type CardResult = {
  cardId: string
  correctCount: number
  questionCount: number
}

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
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: { analyticsGuardrailMinN: true },
    })
    const minN = surgery?.analyticsGuardrailMinN ?? 10

    const profiles = await prisma.dailyDoseProfile.findMany({
      where: { surgeryId },
      select: { userId: true, role: true },
    })
    const roleByUser = new Map(profiles.map((profile) => [profile.userId, profile.role]))
    const roleUserCounts = profiles.reduce((acc, profile) => {
      acc.set(profile.role, (acc.get(profile.role) ?? 0) + 1)
      return acc
    }, new Map<string, number>())

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const sessions = await prisma.dailyDoseSession.findMany({
      where: {
        surgeryId,
        completedAt: { not: null, gte: thirtyDaysAgo },
      },
      select: {
        userId: true,
        completedAt: true,
        cardResults: true,
      },
    })

    const sessionsLast7 = sessions.filter((session) => session.completedAt && session.completedAt >= sevenDaysAgo)
    const sessionsLast30 = sessions

    const engagementByRole = profiles
      .map((profile) => profile.role)
      .filter((role, index, self) => self.indexOf(role) === index)
      .map((role) => {
        const usersLast7 = new Set(
          sessionsLast7.filter((session) => roleByUser.get(session.userId) === role).map((session) => session.userId)
        )
        const usersLast30 = new Set(
          sessionsLast30.filter((session) => roleByUser.get(session.userId) === role).map((session) => session.userId)
        )

        const roleUserCount = roleUserCounts.get(role) ?? 0
        const suppressed = usersLast30.size < minN || roleUserCount === 1
        return {
          role,
          activeUsers7: suppressed ? null : usersLast7.size,
          activeUsers30: suppressed ? null : usersLast30.size,
          suppressed,
          userCount: usersLast30.size,
        }
      })

    const allCardResults: Array<{ userId: string; result: CardResult }> = []
    sessions.forEach((session) => {
      const results = Array.isArray(session.cardResults) ? (session.cardResults as CardResult[]) : []
      results.forEach((result) => allCardResults.push({ userId: session.userId, result }))
    })

    const cardIds = Array.from(new Set(allCardResults.map((entry) => entry.result.cardId)))
    const cards = await prisma.dailyDoseCard.findMany({
      where: { id: { in: cardIds } },
      include: { topic: true },
    })
    const cardMap = new Map(cards.map((card) => [card.id, card]))

    const topicRoleMap = new Map<string, { correct: number; total: number; users: Set<string> }>()
    const topicTotals = new Map<string, { correct: number; total: number; users: Set<string>; name: string }>()
    const topicNames = new Map(cards.map((card) => [card.topicId, card.topic?.name ?? 'Unknown topic']))

    allCardResults.forEach(({ userId, result }) => {
      const role = roleByUser.get(userId)
      const card = cardMap.get(result.cardId)
      if (!role || !card?.topic) return

      const topicKey = `${role}:${card.topicId}`
      const entry = topicRoleMap.get(topicKey) ?? { correct: 0, total: 0, users: new Set<string>() }
      entry.correct += result.correctCount
      entry.total += result.questionCount
      entry.users.add(userId)
      topicRoleMap.set(topicKey, entry)

      const topicTotal = topicTotals.get(card.topicId) ?? {
        correct: 0,
        total: 0,
        users: new Set<string>(),
        name: card.topic.name,
      }
      topicTotal.correct += result.correctCount
      topicTotal.total += result.questionCount
      topicTotal.users.add(userId)
      topicTotals.set(card.topicId, topicTotal)
    })

    const accuracyByTopic = Array.from(topicRoleMap.entries()).map(([key, entry]) => {
      const [role, topicId] = key.split(':')
      const roleUserCount = roleUserCounts.get(role) ?? 0
      const suppressed = entry.users.size < minN || roleUserCount === 1
      const accuracy = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0
      return {
        role,
        topicId,
        topicName: topicNames.get(topicId) ?? 'Unknown topic',
        accuracy: suppressed ? null : accuracy,
        questionCount: suppressed ? null : entry.total,
        userCount: entry.users.size,
        suppressed,
      }
    })

    const commonlyMissedTopics = Array.from(topicTotals.entries())
      .map(([topicId, entry]) => {
        const suppressed = entry.users.size < minN
        const accuracy = entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) : 0
        return {
          topicId,
          topicName: entry.name,
          accuracy: suppressed ? null : accuracy,
          userCount: entry.users.size,
          suppressed,
        }
      })
      .filter((topic) => !topic.suppressed)
      .sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100))
      .slice(0, 3)

    return NextResponse.json({
      surgeryId,
      minN,
      engagementByRole,
      accuracyByTopic,
      commonlyMissedTopics,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('GET /api/daily-dose/insights error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
