import type { DailyDoseCardPayload } from './types'
import {
  DAILY_DOSE_CARDS_PER_SESSION_DEFAULT,
  DAILY_DOSE_CARDS_PER_SESSION_MIN,
  DAILY_DOSE_CARDS_PER_SESSION_MAX,
  DAILY_DOSE_RECALL_ELIGIBILITY_DAYS,
} from './constants'

type CardWithBatchId = DailyDoseCardPayload & { batchId?: string | null }

/**
 * Select multiple cards for a session, prioritizing cards from the same batch/learning unit.
 * Falls back to cards from different batches if needed.
 */
export function selectSessionCards(params: {
  eligibleCards: CardWithBatchId[]
  cardStates: Map<string, { dueAt: Date; incorrectStreak: number; lastReviewedAt?: Date | null }>
  targetCount?: number
  now: Date
}): CardWithBatchId[] {
  const { eligibleCards, cardStates, targetCount = DAILY_DOSE_CARDS_PER_SESSION_DEFAULT, now } = params
  const count = Math.max(
    DAILY_DOSE_CARDS_PER_SESSION_MIN,
    Math.min(DAILY_DOSE_CARDS_PER_SESSION_MAX, targetCount)
  )

  if (eligibleCards.length === 0) return []

  // Categorize cards
  const dueCards = eligibleCards.filter((card) => {
    const state = cardStates.get(card.id)
    return state ? state.dueAt <= now : false
  })

  const newCards = eligibleCards.filter((card) => !cardStates.has(card.id))

  const cardsWithIncorrectAnswers = eligibleCards.filter((card) => {
    const state = cardStates.get(card.id)
    return state && state.incorrectStreak > 0
  })

  // Try to find cards from the same batch
  // Priority: due/new cards first, then incorrect answers
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

  // Find the largest batch with enough cards
  let selectedCards: DailyDoseCardPayload[] = []
  for (const [batchId, batchCards] of cardsByBatch.entries()) {
    if (batchId !== 'no-batch' && batchCards.length >= count) {
      // Found a batch with enough cards - take first N
      selectedCards = batchCards.slice(0, count)
      break
    }
  }

  // If no single batch has enough cards, try to fill from largest batch
  if (selectedCards.length === 0) {
    const largestBatch = Array.from(cardsByBatch.entries())
      .filter(([bid]) => bid !== 'no-batch')
      .sort(([, a], [, b]) => b.length - a.length)[0]

    if (largestBatch) {
      selectedCards = largestBatch[1].slice(0, count)
    }
  }

  // If still not enough, fill from priority cards regardless of batch
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
