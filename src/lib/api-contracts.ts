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
  variants: z.any().nullable().optional(),
  source: z.enum(['base', 'override', 'custom']),
  baseSymptomId: z.string().optional(),
});

export const GetEffectiveSymptomsResZ = z.object({
  symptoms: z.array(EffectiveSymptomZ),
});

export const CreateSymptomReqZ = z.object({
  name: z.string().min(1),
  ageGroup: z.enum(['U5', 'O5', 'Adult']),
  briefInstruction: z.string().optional(),
  highlightedText: z.string().optional(),
  instructions: z.string().optional(),
  instructionsJson: z.any().optional(), // ProseMirror JSON
  instructionsHtml: z.string().optional(), // HTML format with colour support
  linkToPage: z.string().optional(),
  variants: z.any().optional(),
});

export const UpdateSymptomReqZ = z.object({
  name: z.string().min(1).optional(),
  ageGroup: z.enum(['U5', 'O5', 'Adult']).optional(),
  briefInstruction: z.string().optional(),
  highlightedText: z.string().optional(),
  instructions: z.string().optional(),
  instructionsJson: z.any().optional(), // ProseMirror JSON
  instructionsHtml: z.string().optional(), // HTML format with colour support
  linkToPage: z.string().optional(),
  variants: z.any().optional(),
});

// Surgery
export const SurgeryZ = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  adminEmail: z.string().nullable().optional(),
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
