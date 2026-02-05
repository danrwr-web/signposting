import type { DailyDoseCardPayload, DailyDoseQuestion, DailyDoseQuizQuestion } from './types'
import { extractQuestionsFromBlocks, extractQuestionsFromInteractions } from './questions'
import { excludeRecentQuestions, applyVarietyConstraints } from './questionExclusion'
import {
  DAILY_DOSE_QUIZ_LENGTH_DEFAULT,
  DAILY_DOSE_QUIZ_LENGTH_MIN,
  DAILY_DOSE_QUIZ_LENGTH_MAX,
} from './constants'

/**
 * Build quiz questions for session-end quiz.
 * Prioritizes questions from cards shown in the current session.
 * May include up to 1 recall question if needed.
 */
export function buildSessionQuiz(params: {
  sessionCards: DailyDoseCardPayload[]
  recallCards?: DailyDoseCardPayload[]
  recentQuestionIds?: Set<string>
  targetLength?: number
}): DailyDoseQuizQuestion[] {
  const {
    sessionCards,
    recallCards = [],
    recentQuestionIds = new Set(),
    targetLength = DAILY_DOSE_QUIZ_LENGTH_DEFAULT,
  } = params

  const length = Math.max(
    DAILY_DOSE_QUIZ_LENGTH_MIN,
    Math.min(DAILY_DOSE_QUIZ_LENGTH_MAX, targetLength)
  )

  // Extract questions from session cards (primary source)
  const sessionQuestions: DailyDoseQuestion[] = []
  for (const card of sessionCards) {
    sessionQuestions.push(...extractQuestionsFromBlocks(card))
    sessionQuestions.push(...extractQuestionsFromInteractions(card))
  }

  // Apply exclusions
  let pool = excludeRecentQuestions(sessionQuestions, recentQuestionIds)

  // If we don't have enough questions, add recall questions (max 1-2)
  if (pool.length < length && recallCards.length > 0) {
    const recallQuestions: DailyDoseQuestion[] = []
    for (const card of recallCards.slice(0, 2)) {
      recallQuestions.push(...extractQuestionsFromBlocks(card))
      recallQuestions.push(...extractQuestionsFromInteractions(card))
    }
    const filteredRecall = excludeRecentQuestions(recallQuestions, recentQuestionIds)
    // Add at most 2 recall questions, or as many as needed to reach target length
    const recallNeeded = Math.min(2, length - pool.length)
    pool = [...pool, ...filteredRecall.slice(0, recallNeeded)]
  }

  // Apply variety constraints (max 1-2 True/False)
  const constrained = applyVarietyConstraints(pool, pool.length < length ? 2 : 1)

  // Take up to target length
  const selected = constrained.slice(0, length)

  // If still not enough, relax constraints
  if (selected.length < length && pool.length > selected.length) {
    const remaining = pool.filter((q) => !selected.some((s) => s.questionId === q.questionId))
    selected.push(...remaining.slice(0, length - selected.length))
  }

  // Add order numbers
  return selected.map((question, index) => ({
    ...question,
    order: index + 1,
  }))
}
