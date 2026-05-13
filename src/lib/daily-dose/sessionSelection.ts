import type { DailyDoseCardPayload } from './types'
import {
  DAILY_DOSE_CARDS_PER_SESSION_DEFAULT,
  DAILY_DOSE_CARDS_PER_SESSION_MIN,
  DAILY_DOSE_CARDS_PER_SESSION_MAX,
  DAILY_DOSE_RECALL_ELIGIBILITY_DAYS,
} from './constants'

type CardWithBatchId = DailyDoseCardPayload & { batchId?: string | null }

// Anti-repetition: penalise categories that appeared in recent sessions
const ANTI_REPETITION_PENALTY = 0.3

/**
 * Select multiple cards for a session, prioritising cards from the same
 * batch/learning unit. When toolkit relevance scores and/or anti-repetition
 * data are provided, new/unseen cards are sorted by a combined score so
 * that learning is steered toward topics the user engages with day-to-day.
 */
export function selectSessionCards(params: {
  eligibleCards: CardWithBatchId[]
  cardStates: Map<string, { dueAt: Date; incorrectStreak: number; lastReviewedAt?: Date | null }>
  targetCount?: number
  now: Date
  /** Per-card relevance score (0-1) from toolkit engagement. */
  cardRelevanceScores?: Map<string, number>
  /** Category IDs that appeared in the user's recent sessions (for anti-repetition). */
  recentCategoryIds?: Set<string>
  /** Per-card category IDs used for anti-repetition lookup. */
  cardCategoryIds?: Map<string, string[]>
}): CardWithBatchId[] {
  const {
    eligibleCards,
    cardStates,
    targetCount = DAILY_DOSE_CARDS_PER_SESSION_DEFAULT,
    now,
    cardRelevanceScores,
    recentCategoryIds,
    cardCategoryIds,
  } = params

  const count = Math.max(
    DAILY_DOSE_CARDS_PER_SESSION_MIN,
    Math.min(DAILY_DOSE_CARDS_PER_SESSION_MAX, targetCount)
  )

  if (eligibleCards.length === 0) return []

  // Categorise cards into priority buckets
  const dueCards = eligibleCards.filter((card) => {
    const state = cardStates.get(card.id)
    return state ? state.dueAt <= now : false
  })

  const newCards = eligibleCards.filter((card) => !cardStates.has(card.id))

  const cardsWithIncorrectAnswers = eligibleCards.filter((card) => {
    const state = cardStates.get(card.id)
    return state && state.incorrectStreak > 0
  })

  // Score and sort new cards when relevance data is available
  if (cardRelevanceScores && cardRelevanceScores.size > 0) {
    newCards.sort((a, b) => {
      const scoreA = computeCardScore(a.id, cardRelevanceScores, recentCategoryIds, cardCategoryIds)
      const scoreB = computeCardScore(b.id, cardRelevanceScores, recentCategoryIds, cardCategoryIds)
      return scoreB - scoreA
    })
  }

  // Due cards first (spaced repetition), then scored new cards, then incorrect
  const priorityCards = [...dueCards, ...newCards, ...cardsWithIncorrectAnswers] as CardWithBatchId[]

  // Group by batchId
  const cardsByBatch = new Map<string, CardWithBatchId[]>()
  for (const card of priorityCards) {
    const batchId = card.batchId || 'no-batch'
    if (!cardsByBatch.has(batchId)) {
      cardsByBatch.set(batchId, [])
    }
    cardsByBatch.get(batchId)!.push(card)
  }

  // Pick the best batch — prefer batches with higher average relevance
  let selectedCards: DailyDoseCardPayload[] = []
  const batchCandidates = Array.from(cardsByBatch.entries())
    .filter(([bid]) => bid !== 'no-batch')

  if (cardRelevanceScores && cardRelevanceScores.size > 0 && batchCandidates.length > 0) {
    const scoredBatches = batchCandidates
      .filter(([, cards]) => cards.length >= count)
      .map(([bid, cards]) => {
        const avgScore = cards.reduce(
          (sum, c) => sum + (cardRelevanceScores.get(c.id) ?? 0), 0,
        ) / cards.length
        return { bid, cards, avgScore }
      })
      .sort((a, b) => b.avgScore - a.avgScore)

    if (scoredBatches.length > 0) {
      selectedCards = scoredBatches[0].cards.slice(0, count)
    }
  }

  // Fallback: original batch selection (first batch with enough cards)
  if (selectedCards.length === 0) {
    for (const [batchId, batchCards] of batchCandidates) {
      if (batchCards.length >= count) {
        selectedCards = batchCards.slice(0, count)
        break
      }
    }
  }

  // If no single batch has enough cards, try the largest batch
  if (selectedCards.length === 0) {
    const largestBatch = batchCandidates
      .sort(([, a], [, b]) => b.length - a.length)[0]

    if (largestBatch) {
      selectedCards = largestBatch[1].slice(0, count)
    }
  }

  // Fill remaining slots from priority cards regardless of batch
  if (selectedCards.length < count) {
    const remaining = count - selectedCards.length
    const selectedIds = new Set(selectedCards.map((c) => c.id))
    const additional = priorityCards
      .filter((card) => !selectedIds.has(card.id))
      .slice(0, remaining)
    selectedCards = [...selectedCards, ...additional]
  }

  // Final fallback: any eligible cards
  if (selectedCards.length < count) {
    const selectedIds = new Set(selectedCards.map((c) => c.id))
    const additional = eligibleCards
      .filter((card) => !selectedIds.has(card.id))
      .slice(0, count - selectedCards.length)
    selectedCards = [...selectedCards, ...additional]
  }

  return selectedCards.slice(0, count)
}

/**
 * Compute a combined score for a card based on toolkit relevance and
 * anti-repetition penalty. Higher = more desirable.
 */
function computeCardScore(
  cardId: string,
  relevanceScores: Map<string, number>,
  recentCategoryIds?: Set<string>,
  cardCategoryIds?: Map<string, string[]>,
): number {
  const relevance = relevanceScores.get(cardId) ?? 0

  let penalty = 0
  if (recentCategoryIds && recentCategoryIds.size > 0 && cardCategoryIds) {
    const cats = cardCategoryIds.get(cardId) ?? []
    if (cats.some((catId) => recentCategoryIds.has(catId))) {
      penalty = ANTI_REPETITION_PENALTY
    }
  }

  return relevance - penalty
}

/**
 * Select warm-up recall questions from previous sessions.
 * Returns 0-2 cards that are eligible for recall.
 */
export function selectWarmupRecallCards(params: {
  eligibleCards: CardWithBatchId[]
  cardStates: Map<string, { dueAt: Date; incorrectStreak: number; lastReviewedAt?: Date | null }>
  maxCount?: number
  now: Date
}): CardWithBatchId[] {
  const {
    eligibleCards,
    cardStates,
    maxCount = 2,
    now,
  } = params

  // Find cards that are eligible for recall:
  // - Have incorrect streak > 0, OR
  // - Not reviewed for >= RECALL_ELIGIBILITY_DAYS
  const recallEligible = eligibleCards.filter((card) => {
    const state = cardStates.get(card.id)
    if (!state) return false

    // Has incorrect answers
    if (state.incorrectStreak > 0) return true

    // Not reviewed for a while
    if (state.lastReviewedAt) {
      const daysSinceReview = Math.floor(
        (now.getTime() - state.lastReviewedAt.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysSinceReview >= DAILY_DOSE_RECALL_ELIGIBILITY_DAYS) return true
    }

    return false
  })

  // Sort by priority: higher incorrect streak first, then older reviews
  recallEligible.sort((a, b) => {
    const aState = cardStates.get(a.id)!
    const bState = cardStates.get(b.id)!

    // Prioritize incorrect streak
    if (aState.incorrectStreak !== bState.incorrectStreak) {
      return bState.incorrectStreak - aState.incorrectStreak
    }

    // Then prioritize older reviews
    if (aState.lastReviewedAt && bState.lastReviewedAt) {
      return aState.lastReviewedAt.getTime() - bState.lastReviewedAt.getTime()
    }
    if (aState.lastReviewedAt) return -1
    if (bState.lastReviewedAt) return 1
    return 0
  })

  return recallEligible.slice(0, maxCount)
}
