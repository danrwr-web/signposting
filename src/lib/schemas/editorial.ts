import { z } from 'zod'

export const EditorialRoleZ = z.enum(['ADMIN', 'GP', 'NURSE'])
export const EditorialStatusZ = z.enum(['DRAFT', 'APPROVED', 'PUBLISHED', 'ARCHIVED'])
export const EditorialRiskZ = z.enum(['LOW', 'MED', 'HIGH'])

export const EditorialSourceZ = z.object({
  title: z.string().min(1),
  url: z
    .union([
      z.string().startsWith('/s/'), // Relative URL for surgery signposting pages
      z.string().startsWith('/symptom/'), // Relative URL for specific symptom pages
      z.string().url(), // Absolute URL (e.g., https://example.com)
      z.string().length(0), // Empty string
      z.literal(null),
      z.undefined(),
    ])
    .nullable()
    .optional()
    .transform((val) => {
      // Convert empty strings and undefined to null for internal/practice-specific sources
      if (val === '' || val === undefined) return null
      return val
    }),
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
  interactiveFirst: z.boolean().default(true),
  overrideValidation: z.boolean().optional().default(false),
  // Superuser-only: override the constructed prompts before sending to AI
  systemPromptOverride: z.string().optional(),
  userPromptOverride: z.string().optional(),
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
  // Note: clinician approval is now handled separately via the /approve endpoint
  // Learning pathway assignment (single, legacy — kept for compatibility)
  learningCategoryId: z.string().nullable().optional(),
  learningSubsection: z.string().nullable().optional(),
  // Learning pathway assignment (multi-category)
  learningAssignments: z.array(LearningAssignmentZ).nullable().optional(),
})

export const EditorialApproveRequestZ = z.object({
  surgeryId: z.string().optional(),
  cardId: z.string().min(1),
})

export const EditorialPublishRequestZ = z.object({
  surgeryId: z.string().optional(),
  cardId: z.string().min(1),
})

// Prompt template management (superuser settings)
export const EditorialPromptTemplateUpdateZ = z.object({
  role: EditorialRoleZ,
  template: z.string().min(10),
})

export const EditorialPromptTemplateResetZ = z.object({
  role: EditorialRoleZ,
})

// Tag management (superuser settings)
export const EditorialTagCreateZ = z.object({
  name: z.string().min(1).max(50).trim(),
})

export const EditorialTagUpdateZ = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50).trim(),
})

export const EditorialTagDeleteZ = z.object({
  id: z.string().min(1),
})

export const EditorialCardTagsUpdateZ = z.object({
  tags: z.array(z.string().min(1)).default([]),
  surgeryId: z.string().optional(),
})

// Learning pathway assignment (multi-category per card)
export const LearningAssignmentZ = z.object({
  categoryId: z.string().min(1),
  categoryName: z.string().min(1),
  subsection: z.string().nullable().optional(),
})

export type LearningAssignment = z.infer<typeof LearningAssignmentZ>

// Learning category management (superuser settings)
export const LearningCategoryCreateZ = z.object({
  name: z.string().min(1).max(100).trim(),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'Slug must only contain lowercase letters, numbers and underscores')
    .trim(),
  ordering: z.number().int().min(0).default(0),
  subsections: z.array(z.string().min(1)).min(1),
})

export const LearningCategoryUpdateZ = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  ordering: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  subsections: z.array(z.string().min(1)).min(1).optional(),
})

// Card learning-category assignment (part of card update or standalone)
export const CardLearningCategoryUpdateZ = z.object({
  learningCategoryId: z.string().nullable().optional(),
  learningSubsection: z.string().nullable().optional(),
  surgeryId: z.string().optional(),
})

export type EditorialRole = z.infer<typeof EditorialRoleZ>
export type EditorialStatus = z.infer<typeof EditorialStatusZ>
export type EditorialRisk = z.infer<typeof EditorialRiskZ>
