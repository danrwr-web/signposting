import { prisma } from '@/lib/prisma'

/**
 * Returns the set of LearningCategory IDs that appeared in the user's
 * most recent N completed sessions. Used as an anti-repetition signal
 * so session card selection avoids hammering the same subjects.
 */
export async function getRecentSessionCategoryIds(params: {
  userId: string
  surgeryId: string
  sessionCount?: number
}): Promise<Set<string>> {
  const { userId, surgeryId, sessionCount = 3 } = params

  const recentSessions = await prisma.dailyDoseSession.findMany({
    where: {
      userId,
      surgeryId,
      completedAt: { not: null },
    },
    orderBy: { completedAt: 'desc' },
    take: sessionCount,
    select: { cardIds: true },
  })

  if (recentSessions.length === 0) return new Set()

  const allCardIds = new Set<string>()
  for (const session of recentSessions) {
    const ids = Array.isArray(session.cardIds) ? (session.cardIds as string[]) : []
    for (const id of ids) allCardIds.add(id)
  }

  if (allCardIds.size === 0) return new Set()

  const cards = await prisma.dailyDoseCard.findMany({
    where: { id: { in: [...allCardIds] } },
    select: { learningAssignments: true, learningCategoryId: true },
  })

  const categoryIds = new Set<string>()
  for (const card of cards) {
    if (card.learningCategoryId) categoryIds.add(card.learningCategoryId)
    const assignments = Array.isArray(card.learningAssignments)
      ? (card.learningAssignments as Array<{ categoryId?: string }>)
      : []
    for (const a of assignments) {
      if (a.categoryId) categoryIds.add(a.categoryId)
    }
  }

  return categoryIds
}
