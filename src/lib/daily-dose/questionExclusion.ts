import type { DailyDoseQuestion } from './types'
import { getQuestionId } from './questionId'
import { DAILY_DOSE_RECENT_SESSION_EXCLUSION_WINDOW } from './constants'
import { prisma } from '@/lib/prisma'
import { extractQuestionsFromBlocks, extractQuestionsFromInteractions } from './questions'
import type { DailyDoseCardPayload } from './types'

/**
 * Get question IDs that were shown in recent sessions for exclusion.
 * Returns a Set of question IDs to exclude from the current session.
 */
export async function getRecentQuestionIds(params: {
  userId: string
  surgeryId: string
  excludeLastNSessions?: number
}): Promise<Set<string>> {
  const { userId, surgeryId, excludeLastNSessions = DAILY_DOSE_RECENT_SESSION_EXCLUSION_WINDOW } = params
  
  // Query recent completed sessions
  const recentSessions = await prisma.dailyDoseSession.findMany({
    where: {
      userId,
      surgeryId,
      completedAt: { not: null },
    },
    orderBy: { completedAt: 'desc' },
    take: excludeLastNSessions,
    select: {
      cardResults: true,
    },
  })

  const questionIds = new Set<string>()

  // Extract question IDs from recent sessions' cardResults
  for (const session of recentSessions) {
    if (!session.cardResults) continue
    
    const cardResults = Array.isArray(session.cardResults)
      ? (session.cardResults as Array<{ questionIds?: string[] }>)
      : []
    
    cardResults.forEach((result) => {
      if (result.questionIds && Array.isArray(result.questionIds)) {
        result.questionIds.forEach((id) => questionIds.add(id))
      }
    })
  }

  return questionIds
}

/**
 * Filter questions to exclude recently used ones.
 */
export function excludeRecentQuestions(
  questions: DailyDoseQuestion[],
  recentQuestionIds: Set<string>
): DailyDoseQuestion[] {
  return questions.filter((question) => {
    const qId = question.questionId || getQuestionId(question)
    return !recentQuestionIds.has(qId)
  })
}

/**
 * Apply variety constraints to question selection:
 * - Max 1 True/False question (unless no alternatives)
 * - Prefer variety in question types
 */
export function applyVarietyConstraints(
  questions: DailyDoseQuestion[],
  maxTrueFalse: number = 1
): DailyDoseQuestion[] {
  const trueFalseQuestions: DailyDoseQuestion[] = []
  const otherQuestions: DailyDoseQuestion[] = []

  questions.forEach((q) => {
    if (q.questionType === 'TRUE_FALSE') {
      trueFalseQuestions.push(q)
    } else {
      otherQuestions.push(q)
    }
  })

  // Take up to maxTrueFalse True/False questions, then fill with others
  const selected: DailyDoseQuestion[] = []
  selected.push(...trueFalseQuestions.slice(0, maxTrueFalse))
  selected.push(...otherQuestions)

  // If we don't have enough questions and have more True/False available, allow more
  if (selected.length < questions.length && trueFalseQuestions.length > maxTrueFalse) {
    const needed = questions.length - selected.length
    selected.push(...trueFalseQuestions.slice(maxTrueFalse, maxTrueFalse + needed))
  }

  return selected
}
