import { z } from 'zod'
import {
  DAILY_DOSE_DEFAULT_STREAK_WEEKDAY_ONLY,
  DAILY_DOSE_QUESTION_TYPES,
  DAILY_DOSE_ROLES,
  DAILY_DOSE_STATUSES,
} from './constants'

export const DailyDoseRoleZ = z.enum(DAILY_DOSE_ROLES)
export const DailyDoseStatusZ = z.enum(DAILY_DOSE_STATUSES)
export const DailyDoseQuestionTypeZ = z.enum(DAILY_DOSE_QUESTION_TYPES)

export const DailyDoseSourceZ = z.object({
  title: z.string().min(1),
  org: z.string().min(1),
  url: z.string().url(),
  publishedDate: z.string().optional(),
})

export const DailyDoseQuestionBlockZ = z.object({
  type: z.literal('question'),
  questionType: DailyDoseQuestionTypeZ,
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correctAnswer: z.string().min(1),
  rationale: z.string().min(1),
  difficulty: z.number().int().min(1).max(3).optional(),
})

export const DailyDoseContentBlockZ = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('paragraph'),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal('reveal'),
    text: z.string().min(1),
  }),
  DailyDoseQuestionBlockZ,
])

export const DailyDosePreferencesZ = z.object({
  weekdayOnlyStreak: z.boolean().default(DAILY_DOSE_DEFAULT_STREAK_WEEKDAY_ONLY),
  chosenFocusTopicIds: z.array(z.string()).default([]),
  baselineConfidence: z.number().int().min(1).max(5).optional(),
})

export const DailyDoseProfileUpsertZ = z.object({
  surgeryId: z.string().optional(),
  role: DailyDoseRoleZ,
  preferences: DailyDosePreferencesZ,
  onboardingCompleted: z.boolean().optional(),
})

export const DailyDoseTopicInputZ = z.object({
  name: z.string().min(1),
  roleScope: z.array(DailyDoseRoleZ).min(1),
  ordering: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export const DailyDoseCardInputZ = z.object({
  title: z.string().min(1),
  topicId: z.string().min(1),
  roleScope: z.array(DailyDoseRoleZ).min(1),
  contentBlocks: z.array(DailyDoseContentBlockZ).min(1),
  sources: z.array(DailyDoseSourceZ).min(1),
  reviewByDate: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  status: DailyDoseStatusZ.optional(),
})

export const DailyDoseCardUpdateZ = DailyDoseCardInputZ.partial()

export const DailyDoseSessionStartZ = z.object({
  surgeryId: z.string().optional(),
})

export const DailyDoseCardResultZ = z.object({
  cardId: z.string(),
  correctCount: z.number().int().min(0),
  questionCount: z.number().int().min(0),
})

export const DailyDoseSessionCompleteZ = z.object({
  sessionId: z.string(),
  surgeryId: z.string().optional(),
  cardResults: z.array(DailyDoseCardResultZ).min(1),
})

export const DailyDoseFlagInputZ = z.object({
  surgeryId: z.string().optional(),
  cardId: z.string(),
  reason: z.string().min(1),
  freeText: z.string().optional(),
})

export const DailyDoseSubmitAnswerZ = z.object({
  surgeryId: z.string().optional(),
  cardId: z.string(),
  blockIndex: z.number().int().min(0),
  answer: z.string().min(1),
})

export const DailyDoseSurgeryQueryZ = z.object({
  surgeryId: z.string().optional(),
})

export const DailyDoseTopicsQueryZ = z.object({
  surgeryId: z.string().optional(),
  role: DailyDoseRoleZ.optional(),
})
