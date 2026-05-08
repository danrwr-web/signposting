export type MasteryState = 'NOT_STARTED' | 'IN_PROGRESS' | 'SECURE'
export type LearningUnitLevel = 'INTRO' | 'CORE' | 'STRETCH'

export const SECURE_ACCURACY_THRESHOLD = 80

type ProgressAccumulator = {
  attemptedQuestions: number
  correctQuestions: number
  reinforcedAt: Date | null
}

export function calculateAccuracyPercent(correctQuestions: number, attemptedQuestions: number): number {
  if (attemptedQuestions <= 0) return 0
  return Number(((correctQuestions / attemptedQuestions) * 100).toFixed(2))
}

export function deriveMasteryState(params: {
  attemptedQuestions: number
  correctQuestions: number
  reinforcedAt: Date | null
}): MasteryState {
  if (params.attemptedQuestions <= 0) return 'NOT_STARTED'
  const accuracyPct = calculateAccuracyPercent(params.correctQuestions, params.attemptedQuestions)
  if (accuracyPct >= SECURE_ACCURACY_THRESHOLD && params.reinforcedAt) {
    return 'SECURE'
  }
  return 'IN_PROGRESS'
}

export function updateProgressAccumulator(params: {
  current: ProgressAccumulator
  sessionAttemptedQuestions: number
  sessionCorrectQuestions: number
  reinforcedAt: Date | null
}): ProgressAccumulator {
  const attemptedQuestions = params.current.attemptedQuestions + params.sessionAttemptedQuestions
  const correctQuestions = params.current.correctQuestions + params.sessionCorrectQuestions
  return {
    attemptedQuestions,
    correctQuestions,
    reinforcedAt: params.current.reinforcedAt ?? params.reinforcedAt,
  }
}
