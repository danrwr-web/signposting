import type { DailyDoseCardPayload, DailyDoseQuestion, DailyDoseQuizQuestion } from './types'
import { extractQuestionsFromBlocks, extractQuestionsFromInteractions } from './questions'
import { excludeRecentQuestions, applyVarietyConstraints } from './questionExclusion'
import { getQuestionId } from './questionId'
import {
  DAILY_DOSE_QUIZ_LENGTH_DEFAULT,
  DAILY_DOSE_QUIZ_LENGTH_MIN,
  DAILY_DOSE_QUIZ_LENGTH_MAX,
} from './constants'

function scoreByTagOverlap(
  question: DailyDoseQuestion,
  cardMap: Map<string, DailyDoseCardPayload>,
  sessionTagSet: Set<string>
): number {
  const card = cardMap.get(question.cardId)
  if (!card?.tags?.length) return 0
  return card.tags.filter((t) => sessionTagSet.has(t)).length
}

/**
 * Build quiz questions for session-end quiz.
 * Primary source: questions from cards in recent sessions (2-8), excluding the last session.
 * Prefer tag overlap with current session. Fallback: current session cards, then recall cards.
 */
export function buildSessionQuiz(params: {
  sessionCards: DailyDoseCardPayload[]
  recentSessionCards?: DailyDoseCardPayload[]
  recallCards?: DailyDoseCardPayload[]
  excludeQuestionIds?: Set<string>
  targetLength?: number
}): DailyDoseQuizQuestion[] {
  const {
    sessionCards,
    recentSessionCards = [],
    recallCards = [],
    excludeQuestionIds = new Set(),
    targetLength = DAILY_DOSE_QUIZ_LENGTH_DEFAULT,
  } = params

  const length = Math.max(
    DAILY_DOSE_QUIZ_LENGTH_MIN,
    Math.min(DAILY_DOSE_QUIZ_LENGTH_MAX, targetLength)
  )

  const sessionTagSet = new Set(
    sessionCards.flatMap((c) => c.tags ?? [])
  )

  const cardMap = new Map<string, DailyDoseCardPayload>()
  for (const c of [...recentSessionCards, ...sessionCards, ...recallCards]) {
    cardMap.set(c.id, c)
  }

  let pool: DailyDoseQuestion[] = []

  if (recentSessionCards.length > 0) {
    const recentQuestions: DailyDoseQuestion[] = []
    for (const card of recentSessionCards) {
      recentQuestions.push(...extractQuestionsFromBlocks(card))
      recentQuestions.push(...extractQuestionsFromInteractions(card))
    }
    const filtered = excludeRecentQuestions(recentQuestions, excludeQuestionIds)
    pool = filtered.sort((a, b) => {
      const scoreA = scoreByTagOverlap(a, cardMap, sessionTagSet)
      const scoreB = scoreByTagOverlap(b, cardMap, sessionTagSet)
      return scoreB - scoreA
    })
  }

  if (pool.length < length) {
    const sessionQuestions: DailyDoseQuestion[] = []
    for (const card of sessionCards) {
      sessionQuestions.push(...extractQuestionsFromBlocks(card))
      sessionQuestions.push(...extractQuestionsFromInteractions(card))
    }
    const filtered = excludeRecentQuestions(sessionQuestions, excludeQuestionIds)
    const existingIds = new Set(pool.map((q) => q.questionId ?? getQuestionId(q)))
    const newOnes = filtered.filter((q) => !existingIds.has(q.questionId ?? getQuestionId(q)))
    pool = [...pool, ...newOnes]
  }

  if (pool.length < length && recallCards.length > 0) {
    const recallQuestions: DailyDoseQuestion[] = []
    for (const card of recallCards.slice(0, 2)) {
      recallQuestions.push(...extractQuestionsFromBlocks(card))
      recallQuestions.push(...extractQuestionsFromInteractions(card))
    }
    const filtered = excludeRecentQuestions(recallQuestions, excludeQuestionIds)
    const existingIds = new Set(pool.map((q) => q.questionId ?? getQuestionId(q)))
    const newOnes = filtered.filter((q) => !existingIds.has(q.questionId ?? getQuestionId(q)))
    pool = [...pool, ...newOnes.slice(0, length - pool.length)]
  }

  const constrained = applyVarietyConstraints(pool, pool.length < length ? 2 : 1)
  const selected = constrained.slice(0, length)

  if (selected.length < length && pool.length > selected.length) {
    const selectedIds = new Set(selected.map((q) => q.questionId ?? getQuestionId(q)))
    const remaining = pool.filter((q) => !selectedIds.has(q.questionId ?? getQuestionId(q)))
    selected.push(...remaining.slice(0, length - selected.length))
  }

  return selected.map((question, index) => ({
    ...question,
    order: index + 1,
  }))
}
