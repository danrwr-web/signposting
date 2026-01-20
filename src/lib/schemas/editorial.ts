import { z } from 'zod'

export const EditorialRoleZ = z.enum(['ADMIN', 'GP', 'NURSE'])
export const EditorialStatusZ = z.enum(['DRAFT', 'APPROVED', 'PUBLISHED', 'ARCHIVED'])
export const EditorialRiskZ = z.enum(['LOW', 'MED', 'HIGH'])

export const EditorialSourceZ = z.object({
  title: z.string().min(1),
  url: z.string().url().nullable().optional(), // Allow null for internal/practice-specific sources
  publisher: z.string().optional(),
  accessedDate: z.string().optional(),
})

export const EditorialContentBlockZ = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal('callout'),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal('steps'),
    items: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal('do-dont'),
    items: z.array(z.string().min(1)).min(2),
  }),
])

export const EditorialInteractionZ = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('mcq'),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    correctIndex: z.number().int().min(0),
    explanation: z.string().min(1),
  }),
  z.object({
    type: z.literal('true_false'),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).length(2),
    correctIndex: z.number().int().min(0).max(1),
    explanation: z.string().min(1),
  }),
  z.object({
    type: z.literal('choose_action'),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    correctIndex: z.number().int().min(0),
    explanation: z.string().min(1),
  }),
])

export const EditorialSlotLanguageZ = z.object({
  relevant: z.boolean(),
  guidance: z.array(
    z.object({
      slot: z.enum(['Red', 'Orange', 'Pink-Purple', 'Green']),
      rule: z.string().min(1),
    })
  ),
})

export const EditorialGeneratedFromZ = z.object({
  type: z.enum(['prompt', 'variation', 'regen']),
  sourceCardId: z.string().optional(),
  section: z.string().optional(),
})

export const EditorialLearningCardZ = z.object({
  targetRole: EditorialRoleZ,
  title: z.string().min(1),
  estimatedTimeMinutes: z.number().int().min(3).max(10),
  tags: z.array(z.string().min(1)).default([]),
  riskLevel: EditorialRiskZ,
  needsSourcing: z.boolean(),
  reviewByDate: z.string().min(1),
  sources: z.array(EditorialSourceZ).min(1),
  contentBlocks: z.array(EditorialContentBlockZ).min(1),
  interactions: z.array(EditorialInteractionZ).min(1),
  slotLanguage: EditorialSlotLanguageZ,
  safetyNetting: z.array(z.string().min(1)).min(1),
})

export const EditorialQuizQuestionZ = z.object({
  type: z.enum(['mcq', 'true_false']),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correctIndex: z.number().int().min(0),
  explanation: z.string().min(1),
  linkedCardIds: z.array(z.string()).optional(),
})

export const EditorialQuizZ = z.object({
  title: z.string().min(1),
  questions: z.array(EditorialQuizQuestionZ).min(1),
})

export const EditorialGenerationOutputZ = z.object({
  cards: z.array(EditorialLearningCardZ).min(1),
  quiz: EditorialQuizZ,
})

export const EditorialGenerateRequestZ = z.object({
  surgeryId: z.string().optional(),
  promptText: z.string().min(10),
  targetRole: EditorialRoleZ,
  count: z.number().int().min(1).max(10).default(5),
  tags: z.array(z.string().min(1)).optional(),
  interactiveFirst: z.boolean().default(true),
})

export const EditorialVariationsRequestZ = z.object({
  surgeryId: z.string().optional(),
  cardId: z.string().min(1),
  variationsCount: z.number().int().min(1).max(5).default(3),
})

export const EditorialRegenerateSectionRequestZ = z.object({
  surgeryId: z.string().optional(),
  cardId: z.string().min(1),
  section: z.enum([
    'title',
    'scenario',
    'mcq',
    'answerOptions',
    'feedback',
    'safetyNetting',
    'sources',
    'slotLanguage',
  ]),
  userInstruction: z.string().optional(),
})

export const EditorialCardUpdateZ = z.object({
  title: z.string().min(1),
  targetRole: EditorialRoleZ,
  estimatedTimeMinutes: z.number().int().min(3).max(10),
  tags: z.array(z.string().min(1)).default([]),
  riskLevel: EditorialRiskZ,
  needsSourcing: z.boolean(),
  reviewByDate: z.string().min(1).optional().nullable(),
  sources: z.array(EditorialSourceZ).optional().default([]),
  contentBlocks: z.array(EditorialContentBlockZ).min(1),
  interactions: z.array(EditorialInteractionZ).min(1),
  slotLanguage: EditorialSlotLanguageZ,
  safetyNetting: z.array(z.string().min(1)).min(1),
  clinicianApproved: z.boolean().optional(),
  clinicianApprovedBy: z.string().optional(),
})

export const EditorialApproveRequestZ = z.object({
  surgeryId: z.string().optional(),
  cardId: z.string().min(1),
})

export const EditorialPublishRequestZ = z.object({
  surgeryId: z.string().optional(),
  cardId: z.string().min(1),
})

export type EditorialRole = z.infer<typeof EditorialRoleZ>
export type EditorialStatus = z.infer<typeof EditorialStatusZ>
export type EditorialRisk = z.infer<typeof EditorialRiskZ>
