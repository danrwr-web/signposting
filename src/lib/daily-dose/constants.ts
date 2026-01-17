export const DAILY_DOSE_ROLES = ['GP', 'NURSE', 'ADMIN'] as const
export type DailyDoseRole = (typeof DAILY_DOSE_ROLES)[number]

export const DAILY_DOSE_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
  'RETIRED',
] as const
export type DailyDoseStatus = (typeof DAILY_DOSE_STATUSES)[number]

export const DAILY_DOSE_QUESTION_TYPES = ['MCQ', 'TRUE_FALSE', 'SCENARIO'] as const
export type DailyDoseQuestionType = (typeof DAILY_DOSE_QUESTION_TYPES)[number]

export const DAILY_DOSE_LEITNER_INTERVALS = [1, 3, 7, 14, 30] as const
export const DAILY_DOSE_QUIZ_MIN_QUESTIONS = 3
export const DAILY_DOSE_QUIZ_MAX_QUESTIONS = 6
export const DAILY_DOSE_DEFAULT_STREAK_WEEKDAY_ONLY = true

export const DAILY_DOSE_XP = {
  sessionBase: 10,
  perCorrect: 5,
  maxPerSession: 50,
} as const
