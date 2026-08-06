/**
 * API response contracts using Zod for validation
 * Server-only module for type safety and runtime validation
 */

import { z } from 'zod';

// Highlight Rules
export const HighlightRuleZ = z.object({
  id: z.string(),
  phrase: z.string(),
  textColor: z.string(),
  bgColor: z.string(),
  isEnabled: z.boolean(),
  surgeryId: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

export const GetHighlightsResZ = z.object({
  highlights: z.array(HighlightRuleZ), // force array under "highlights"
  enableBuiltInHighlights: z.boolean().optional(),
  enableImageIcons: z.boolean().optional(),
});

export const CreateHighlightReqZ = z.object({
  phrase: z.string().min(1).max(80),
  textColor: z.string().default('#FFFFFF'),
  bgColor: z.string().default('#6A0DAD'),
  isEnabled: z.boolean().default(true),
  surgeryId: z.string().optional(),
  isGlobal: z.boolean().optional(), // For superusers to create global rules
});

export const UpdateHighlightReqZ = z.object({
  phrase: z.string().min(1).max(80).optional(),
  textColor: z.string().optional(),
  bgColor: z.string().optional(),
  isEnabled: z.boolean().optional(),
});

// High Risk Links
export const HighRiskLinkZ = z.object({
  id: z.string(),
  label: z.string(),
  symptomSlug: z.string().nullable().optional(),
  symptomId: z.string().nullable().optional(),
  orderIndex: z.number(),
  isDefault: z.boolean().optional(),
});

export const GetHighRiskResZ = z.object({
  links: z.array(HighRiskLinkZ),
});

export const CreateHighRiskReqZ = z.object({
  label: z.string().optional(),
  symptomSlug: z.string().optional(),
  symptomId: z.string().optional(),
  orderIndex: z.number().default(0),
}).refine((v) => !!(v.symptomId || v.symptomSlug), {
  message: 'A symptom must be selected',
});

export const UpdateHighRiskReqZ = z.object({
  label: z.string().min(1).optional(),
  symptomSlug: z.string().optional(),
  symptomId: z.string().optional(),
  orderIndex: z.number().optional(),
});

// Default High Risk Button Config
export const DefaultHighRiskButtonConfigZ = z.object({
  id: z.string(),
  buttonKey: z.string(),
  label: z.string(),
  symptomSlug: z.string(),
  isEnabled: z.boolean(),
  orderIndex: z.number(),
});

export const GetDefaultHighRiskButtonsResZ = z.object({
  buttons: z.array(DefaultHighRiskButtonConfigZ),
});

export const UpdateDefaultHighRiskButtonReqZ = z.object({
  buttonKey: z.string(),
  label: z.string().optional(),
  symptomSlug: z.string().optional(),
  isEnabled: z.boolean().optional(),
  orderIndex: z.number().optional(),
});

// Effective Symptoms
export const EffectiveSymptomZ = z.object({
  id: z.string(),
  slug: z.string().optional(),
  name: z.string(),
  ageGroup: z.enum(['U5', 'O5', 'Adult']),
  briefInstruction: z.string().nullable().optional(),
  highlightedText: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  instructionsJson: z.string().nullable().optional(), // ProseMirror JSON as string
  instructionsHtml: z.string().nullable().optional(), // HTML format with colour support
  linkToPage: z.string().nullable().optional(),
  linkToPages: z.array(z.string()).nullable().optional(),
  variants: z.any().nullable().optional(),
  source: z.enum(['base', 'override', 'custom']),
  baseSymptomId: z.string().optional(),
  // Server-computed plain-text search index (see src/lib/symptomSearch.ts)
  searchText: z.string().optional(),
});

export const GetEffectiveSymptomsResZ = z.object({
  symptoms: z.array(EffectiveSymptomZ),
});

// Age-group variants. Base symptoms carry the shared variants; a surgery's
// override may carry its own to replace them (or hide them — see below).
const VariantAgeGroupZ = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  instructions: z.string(), // HTML
});

export const SymptomVariantsZ = z.object({
  heading: z.string().optional(),
  position: z.enum(['before', 'after']).optional(),
  ageGroups: z.array(VariantAgeGroupZ).min(1),
});
export type SymptomVariants = z.infer<typeof SymptomVariantsZ>;

// Value stored on SurgerySymptomOverride.variants: same shape, but an empty
// ageGroups array is allowed and means "hide variants for this surgery"
// (null/absent means inherit the base symptom's variants).
export const SurgeryVariantsOverrideZ = z.object({
  heading: z.string().optional(),
  position: z.enum(['before', 'after']).optional(),
  ageGroups: z.array(VariantAgeGroupZ),
});
export type SurgeryVariantsOverride = z.infer<typeof SurgeryVariantsOverrideZ>;

// Related-symptom links: names of other symptoms, resolved case-insensitively
// at click time. On overrides the stored value is tri-state: null = inherit
// base links, [] = explicitly none for this surgery, [...] = replace.
export const LinkToPagesZ = z.array(z.string().min(1).max(200)).max(10);

export const CreateSymptomReqZ = z.object({
  name: z.string().min(1),
  ageGroup: z.enum(['U5', 'O5', 'Adult']),
  briefInstruction: z.string().optional(),
  highlightedText: z.string().optional(),
  instructions: z.string().optional(),
  instructionsJson: z.any().optional(), // Legacy ProseMirror JSON (no longer written)
  instructionsHtml: z.string().optional(), // HTML format with colour support
  linkToPage: z.string().optional(),
  linkToPages: LinkToPagesZ.nullable().optional(),
  variants: SymptomVariantsZ.nullable().optional(),
});

export const UpdateSymptomReqZ = z.object({
  name: z.string().min(1).optional(),
  ageGroup: z.enum(['U5', 'O5', 'Adult']).optional(),
  briefInstruction: z.string().optional(),
  highlightedText: z.string().optional(),
  instructions: z.string().optional(),
  instructionsJson: z.any().optional(), // Legacy ProseMirror JSON (no longer written)
  instructionsHtml: z.string().optional(), // HTML format with colour support
  linkToPage: z.string().optional(),
  linkToPages: LinkToPagesZ.nullable().optional(),
  variants: SymptomVariantsZ.nullable().optional(),
});

// Surgery
export const SurgeryTypeZ = z.enum(['LIVE', 'TEST', 'GLOBAL_DEFAULT']);
export type SurgeryTypeValue = z.infer<typeof SurgeryTypeZ>;

export const SurgeryZ = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  adminEmail: z.string().nullable().optional(),
  surgeryType: SurgeryTypeZ.optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export const GetSurgeriesResZ = z.object({
  surgeries: z.array(SurgeryZ),
});

export const CreateSurgeryReqZ = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  adminEmail: z.string().email().optional(),
  adminPassword: z.string().min(6).optional(),
});

export const UpdateSurgeryReqZ = z.object({
  name: z.string().min(1).optional(),
  adminEmail: z.string().email().optional(),
  adminPassword: z.string().min(6).optional(),
  surgeryType: SurgeryTypeZ.optional(),
});

// Auth
export const LoginReqZ = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const LoginResZ = z.object({
  success: z.boolean(),
  redirectTo: z.string().optional(),
  message: z.string().optional(),
});

// Common error response
export const ErrorResZ = z.object({
  error: z.string(),
  message: z.string().optional(),
  status: z.number().optional(),
});

// Type exports
export type HighlightRule = z.infer<typeof HighlightRuleZ>;
export type HighRiskLink = z.infer<typeof HighRiskLinkZ>;
export type DefaultHighRiskButtonConfig = z.infer<typeof DefaultHighRiskButtonConfigZ>;
export type EffectiveSymptom = z.infer<typeof EffectiveSymptomZ>;
export type Surgery = z.infer<typeof SurgeryZ>;
export type CreateHighlightReq = z.infer<typeof CreateHighlightReqZ>;
export type UpdateHighlightReq = z.infer<typeof UpdateHighlightReqZ>;
export type CreateHighRiskReq = z.infer<typeof CreateHighRiskReqZ>;
export type UpdateHighRiskReq = z.infer<typeof UpdateHighRiskReqZ>;
export type UpdateDefaultHighRiskButtonReq = z.infer<typeof UpdateDefaultHighRiskButtonReqZ>;
export type CreateSymptomReq = z.infer<typeof CreateSymptomReqZ>;
export type UpdateSymptomReq = z.infer<typeof UpdateSymptomReqZ>;
export type CreateSurgeryReq = z.infer<typeof CreateSurgeryReqZ>;
export type UpdateSurgeryReq = z.infer<typeof UpdateSurgeryReqZ>;
export type LoginReq = z.infer<typeof LoginReqZ>;
export type LoginRes = z.infer<typeof LoginResZ>;
export type ErrorRes = z.infer<typeof ErrorResZ>;

// Appointment Taxonomy
export const AppointmentArchetypeConfigZ = z.object({
  enabled: z.boolean().default(false),
  localName: z.string().default(''),
  clinicianRole: z.string().default(''),
  description: z.string().default(''),
});

export const ClinicianArchetypeConfigZ = z.object({
  key: z.string(),
  enabled: z.boolean().default(false),
  localName: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  restrictions: z.string().optional().nullable(),
  acceptsUnderFives: z.boolean().optional().nullable(),
  conditions: z.array(z.string()).optional().default([]),
});

export const AppointmentModelConfigZ = z.object({
  routineContinuityGp: AppointmentArchetypeConfigZ.default({ enabled: false, localName: '', clinicianRole: '', description: '' }),
  routineGpPhone: AppointmentArchetypeConfigZ.default({ enabled: false, localName: '', clinicianRole: '', description: '' }),
  gpTriage48h: AppointmentArchetypeConfigZ.default({ enabled: false, localName: '', clinicianRole: '', description: '' }),
  urgentSameDayPhone: AppointmentArchetypeConfigZ.default({ enabled: false, localName: '', clinicianRole: '', description: '' }),
  urgentSameDayF2F: AppointmentArchetypeConfigZ.default({ enabled: false, localName: '', clinicianRole: '', description: '' }),
  otherClinicianDirect: AppointmentArchetypeConfigZ.default({ enabled: false, localName: '', clinicianRole: '', description: '' }),
  clinicianArchetypes: z.array(ClinicianArchetypeConfigZ).default([]),
});

export type AppointmentArchetypeConfig = z.infer<typeof AppointmentArchetypeConfigZ>;
export type ClinicianArchetypeConfig = z.infer<typeof ClinicianArchetypeConfigZ>;
export type AppointmentModelConfig = z.infer<typeof AppointmentModelConfigZ>;

// Surgery Onboarding Profile
export const SurgeryOnboardingProfileJsonZ = z.object({
  surgeryName: z.string().nullable(),
  urgentCareModel: z.object({
    hasDutyDoctor: z.boolean(),
    dutyDoctorTerm: z.string().nullable(),
    usesRedSlots: z.boolean(),
    redSlotName: z.string().nullable().optional(), // Kept for backwards compatibility
    urgentSlotsDescription: z.string(),
  }),
  bookingRules: z.object({
    canBookDirectly: z.array(z.string()),
    mustNotBookDirectly: z.string(),
  }),
  team: z.object({
    roles: z.array(z.string()),
    roleRoutingNotes: z.string(),
  }),
  escalation: z.object({
    firstEscalation: z.string().nullable(),
    urgentWording: z.string(),
  }),
  localServices: z.object({
    msk: z.string(),
    mentalHealth: z.string(),
    socialPrescribing: z.string(),
    communityNursing: z.string(),
    audiology: z.string(),
    frailty: z.string(),
    sexualHealth: z.string(),
    outOfHours: z.string(),
    includeInInstructions: z.enum(['yes', 'brief', 'no']),
  }),
  communicationStyle: z.object({
    detailLevel: z.enum(['brief', 'moderate', 'detailed']),
    terminologyPreference: z.enum(['surgery', 'generic', 'mixed']),
  }),
  aiSettings: z.object({
    customisationScope: z.enum(['all', 'core', 'manual']),
    requireClinicalReview: z.boolean(),
  }),
  appointmentModel: AppointmentModelConfigZ.default({
    routineContinuityGp: { enabled: false, localName: '', clinicianRole: '', description: '' },
    routineGpPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
    gpTriage48h: { enabled: false, localName: '', clinicianRole: '', description: '' },
    urgentSameDayPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
    urgentSameDayF2F: { enabled: false, localName: '', clinicianRole: '', description: '' },
    otherClinicianDirect: { enabled: false, localName: '', clinicianRole: '', description: '' },
    clinicianArchetypes: [],
  }),
});

export const GetOnboardingProfileResZ = z.object({
  profileJson: SurgeryOnboardingProfileJsonZ,
  completed: z.boolean(),
  completedAt: z.string().nullable().or(z.date().nullable()),
});

export const UpdateOnboardingProfileReqZ = z.object({
  profileJson: SurgeryOnboardingProfileJsonZ,
  completed: z.boolean().optional(),
});

export type SurgeryOnboardingProfileJson = z.infer<typeof SurgeryOnboardingProfileJsonZ>;
export type GetOnboardingProfileRes = z.infer<typeof GetOnboardingProfileResZ>;
export type UpdateOnboardingProfileReq = z.infer<typeof UpdateOnboardingProfileReqZ>;

// AI Customisation
export const CustomiseScopeZ = z.enum(['all', 'core', 'manual']);

export const CustomiseInstructionsReqZ = z.object({
  scope: CustomiseScopeZ,
  symptomIds: z.array(z.string()).optional(), // required if scope === "manual"
  // When true, each symptom is re-checked server-side immediately before
  // processing and skipped if its content has been edited by a human
  // (see isSymptomSafeToRerun) — used by the superuser smart re-run.
  skipHumanEdited: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.scope === 'manual') {
      return data.symptomIds && data.symptomIds.length > 0;
    }
    return true;
  },
  {
    message: 'symptomIds is required when scope is "manual"',
  }
);

export const CustomiseInstructionsResZ = z.object({
  processedCount: z.number(),
  skippedCount: z.number(),
  message: z.string(),
  skippedDetails: z.array(z.object({
    symptomId: z.string(),
    reason: z.string().optional(),
  })).default([]),
});

export type CustomiseScope = z.infer<typeof CustomiseScopeZ>;
export type CustomiseInstructionsReq = z.infer<typeof CustomiseInstructionsReqZ>;
export type CustomiseInstructionsRes = z.infer<typeof CustomiseInstructionsResZ>;

// Engagement Analytics (admin ?tab=engagement)
export interface EngagementRankedSymptom {
  id: string;
  name: string;
  ageGroup: string;
  viewCount: number;
}

export interface EngagementTotals {
  totalViews: number;
  distinctUsers: number;
  distinctSymptoms: number;
  /** Only computed for the all-surgeries (superuser) scope; null otherwise. */
  activeSurgeries: number | null;
}

export interface EngagementTrendPoint {
  /** Calendar date in Europe/London, formatted YYYY-MM-DD. */
  date: string;
  views: number;
}

export interface EngagementTopRes {
  topSymptoms: EngagementRankedSymptom[];
  topUsers: Array<{ userEmail: string; engagementCount: number }>;
  surgeryBreakdown?: Array<{
    surgeryId: string;
    surgeryName: string;
    surgerySlug: string | null;
    engagementCount: number;
  }>;
  totals: EngagementTotals;
  /** Same-length window immediately before the selected range; null for all time. */
  previousTotals: { totalViews: number; distinctUsers: number } | null;
  trend: {
    bucket: 'day';
    /** True when the all-time range was capped to the most recent 90 days. */
    capped: boolean;
    points: EngagementTrendPoint[];
  };
  insights: {
    leastViewed: EngagementRankedSymptom[];
    neverViewedCount: number;
    trackedSymptomCount: number;
    /** View counts by weekday, Monday-first, Europe/London. */
    byWeekday: number[];
    /** View counts by hour of day (0-23), Europe/London. */
    byHour: number[];
  };
}

// Feedback & suggestions (unified: app feature requests + symptom-content suggestions)
export const SuggestionTypeZ = z.enum(['FEATURE', 'IMPROVEMENT', 'BUG', 'SYMPTOM_CONTENT']);
export const SuggestionStatusZ = z.enum(['PENDING', 'UNDER_REVIEW', 'PLANNED', 'DONE', 'DECLINED']);

export const CreateSuggestionReqZ = z.object({
  type: SuggestionTypeZ,
  title: z.string().trim().max(150).optional(),
  text: z.string().trim().min(1).max(5000),
  surgeryId: z.string().optional(),
  baseId: z.string().optional(),
  symptom: z.string().max(300).optional(),
  pageContext: z.string().max(500).optional(),
}).superRefine((data, ctx) => {
  if (data.type !== 'SYMPTOM_CONTENT' && (!data.title || data.title.length === 0)) {
    ctx.addIssue({
      code: 'custom',
      path: ['title'],
      message: 'title is required for feature, improvement, and bug suggestions',
    });
  }
});

export const UpdateSuggestionTriageReqZ = z.object({
  status: SuggestionStatusZ.optional(),
  response: z.string().trim().max(5000).optional(),
  /** Hand the suggestion over to the practice's own admin queue (surgery-linked, non-symptom-content only). */
  redirectToPractice: z.boolean().optional(),
}).refine(
  (data) => data.status !== undefined || data.response !== undefined || data.redirectToPractice === true,
  { message: 'status, response, or redirectToPractice is required' }
);

export type SuggestionType = z.infer<typeof SuggestionTypeZ>;
export type SuggestionStatus = z.infer<typeof SuggestionStatusZ>;
export type CreateSuggestionReq = z.infer<typeof CreateSuggestionReqZ>;
export type UpdateSuggestionTriageReq = z.infer<typeof UpdateSuggestionTriageReqZ>;

/** Serialised Suggestion row as returned by the suggestions APIs. */
export interface SuggestionRes {
  id: string;
  type: SuggestionType;
  status: SuggestionStatus;
  surgeryId: string | null;
  baseId: string | null;
  symptom: string | null;
  title: string | null;
  text: string;
  pageContext: string | null;
  userEmail: string | null;
  submittedByUserId: string | null;
  response: string | null;
  respondedAt: string | null;
  responseViewedAt: string | null;
  redirectedFromType: SuggestionType | null;
  redirectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  surgery: { id: string; name: string; slug: string | null } | null;
}
