import { prisma } from '@/lib/prisma'

const DEFAULT_WINDOW_DAYS = 30
const DECAY_HALF_LIFE_DAYS = 7
const INDIVIDUAL_WEIGHT = 0.7
const AGGREGATE_WEIGHT = 0.3

type RelevanceScores = Map<
  string,
  { userScore: number; aggregateScore: number; combined: number }
>

/**
 * Apply exponential time-decay: a view from `daysAgo` days in the past
 * contributes `2^(-daysAgo / halfLife)` so recent views dominate.
 */
function decayWeight(daysAgo: number, halfLife: number): number {
  return Math.pow(2, -daysAgo / halfLife)
}

/**
 * Given an array of engagement events, compute weighted scores per
 * admin item ID, with exponential time decay.
 */
function aggregateEvents(
  events: Array<{ adminItemId: string; createdAt: Date }>,
  now: Date,
  halfLife: number,
): Map<string, number> {
  const scores = new Map<string, number>()
  for (const event of events) {
    const daysAgo = (now.getTime() - event.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    const weight = decayWeight(daysAgo, halfLife)
    scores.set(event.adminItemId, (scores.get(event.adminItemId) ?? 0) + weight)
  }
  return scores
}

/**
 * Normalise a map of scores to the range [0, 1] relative to the
 * maximum value in the map.
 */
function normalise(scores: Map<string, number>): Map<string, number> {
  let max = 0
  for (const v of scores.values()) {
    if (v > max) max = v
  }
  if (max === 0) return scores
  const out = new Map<string, number>()
  for (const [k, v] of scores) {
    out.set(k, v / max)
  }
  return out
}

/**
 * Build the AdminItem-ID → LearningCategory-ID reverse mapping from
 * DailyDoseCard.sourceAdminItemIds + learningAssignments.
 *
 * Returns Map<adminItemId, Set<categoryId>>.
 */
async function buildAdminItemToCategoryMap(
  surgeryId: string,
): Promise<Map<string, Set<string>>> {
  const cards = await prisma.dailyDoseCard.findMany({
    where: {
      isActive: true,
      sourceAdminItemIds: { not: { equals: null } },
      OR: [{ surgeryId }, { surgeryId: null }],
    },
    select: {
      sourceAdminItemIds: true,
      learningAssignments: true,
      learningCategoryId: true,
    },
  })

  const map = new Map<string, Set<string>>()

  for (const card of cards) {
    const itemIds = Array.isArray(card.sourceAdminItemIds)
      ? (card.sourceAdminItemIds as string[])
      : []
    if (itemIds.length === 0) continue

    const categoryIds = new Set<string>()
    const assignments = Array.isArray(card.learningAssignments)
      ? (card.learningAssignments as Array<{ categoryId?: string }>)
      : []
    for (const a of assignments) {
      if (a.categoryId) categoryIds.add(a.categoryId)
    }
    if (card.learningCategoryId) categoryIds.add(card.learningCategoryId)

    if (categoryIds.size === 0) continue

    for (const itemId of itemIds) {
      if (!map.has(itemId)) map.set(itemId, new Set())
      const existing = map.get(itemId)!
      for (const catId of categoryIds) {
        existing.add(catId)
      }
    }
  }

  return map
}

/**
 * Convert admin-item-level scores to learning-category-level scores
 * using the item→category mapping. When multiple items map to the
 * same category, take the highest score.
 */
function itemScoresToCategoryScores(
  itemScores: Map<string, number>,
  itemToCategories: Map<string, Set<string>>,
): Map<string, number> {
  const catScores = new Map<string, number>()
  for (const [itemId, score] of itemScores) {
    const cats = itemToCategories.get(itemId)
    if (!cats) continue
    for (const catId of cats) {
      const existing = catScores.get(catId) ?? 0
      catScores.set(catId, Math.max(existing, score))
    }
  }
  return catScores
}

/**
 * Compute per-learning-category relevance scores based on toolkit
 * page usage. Combines individual user engagement with aggregate
 * practice-wide engagement (weighted blend).
 *
 * For new users with no personal toolkit history, falls back
 * entirely to the aggregate signal.
 */
export async function computeToolkitRelevanceScores(params: {
  surgeryId: string
  userId: string
  windowDays?: number
  halfLifeDays?: number
}): Promise<RelevanceScores> {
  const {
    surgeryId,
    userId,
    windowDays = DEFAULT_WINDOW_DAYS,
    halfLifeDays = DECAY_HALF_LIFE_DAYS,
  } = params

  const now = new Date()
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)

  const [userEvents, allEvents, itemToCategories] = await Promise.all([
    prisma.adminToolkitEngagementEvent.findMany({
      where: {
        surgeryId,
        userId,
        event: 'view_item',
        createdAt: { gte: windowStart },
      },
      select: { adminItemId: true, createdAt: true },
    }),
    prisma.adminToolkitEngagementEvent.findMany({
      where: {
        surgeryId,
        event: 'view_item',
        createdAt: { gte: windowStart },
      },
      select: { adminItemId: true, createdAt: true },
    }),
    buildAdminItemToCategoryMap(surgeryId),
  ])

  const userItemScores = normalise(aggregateEvents(userEvents, now, halfLifeDays))
  const aggItemScores = normalise(aggregateEvents(allEvents, now, halfLifeDays))

  const userCatScores = normalise(
    itemScoresToCategoryScores(userItemScores, itemToCategories),
  )
  const aggCatScores = normalise(
    itemScoresToCategoryScores(aggItemScores, itemToCategories),
  )

  const hasUserHistory = userEvents.length > 0
  const indWeight = hasUserHistory ? INDIVIDUAL_WEIGHT : 0
  const aggWeight = hasUserHistory ? AGGREGATE_WEIGHT : 1.0

  const allCategoryIds = new Set([...userCatScores.keys(), ...aggCatScores.keys()])
  const result: RelevanceScores = new Map()

  for (const catId of allCategoryIds) {
    const userScore = userCatScores.get(catId) ?? 0
    const aggregateScore = aggCatScores.get(catId) ?? 0
    const combined = indWeight * userScore + aggWeight * aggregateScore
    result.set(catId, { userScore, aggregateScore, combined })
  }

  return result
}
