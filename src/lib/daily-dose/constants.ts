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

// Session flow configuration
export const DAILY_DOSE_CARDS_PER_SESSION_MIN = 3
export const DAILY_DOSE_CARDS_PER_SESSION_MAX = 5
export const DAILY_DOSE_CARDS_PER_SESSION_DEFAULT = 4
export const DAILY_DOSE_QUIZ_LENGTH_DEFAULT = 5
export const DAILY_DOSE_QUIZ_LENGTH_MIN = 4
export const DAILY_DOSE_QUIZ_LENGTH_MAX = 6
export const DAILY_DOSE_WARMUP_RECALL_MAX = 2
export const DAILY_DOSE_RECENT_SESSION_EXCLUSION_WINDOW = 3 // Exclude questions from last N sessions
export const DAILY_DOSE_RECALL_ELIGIBILITY_DAYS = 7 // Days before a card/question is eligible for recall

/** Max context length (chars) for single-page quiz layout; longer context uses two-page flow */
export const QUIZ_CONTEXT_SINGLE_PAGE_MAX_CHARS = 400

export const DAILY_DOSE_XP = {
  sessionBase: 10,
  perCorrect: 5,
  maxPerSession: 50,
} as const
