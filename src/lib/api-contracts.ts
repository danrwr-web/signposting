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
});

export const CreateHighlightReqZ = z.object({
  phrase: z.string().min(1).max(80),
  textColor: z.string().default('#FFFFFF'),
  bgColor: z.string().default('#6A0DAD'),
  isEnabled: z.boolean().default(true),
  surgeryId: z.string().optional(),
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
});

export const GetHighRiskResZ = z.object({
  links: z.array(HighRiskLinkZ),
});

export const CreateHighRiskReqZ = z.object({
  label: z.string().min(1),
  symptomSlug: z.string().optional(),
  symptomId: z.string().optional(),
  orderIndex: z.number().default(0),
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
  label: z.string().min(1).optional(),
  symptomSlug: z.string().min(1).optional(),
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
  linkToPage: z.string().nullable().optional(),
  source: z.enum(['base', 'override', 'custom']),
  baseSymptomId: z.string().optional(),
});

export const GetEffectiveSymptomsResZ = z.object({
  symptoms: z.array(EffectiveSymptomZ),
});

export const CreateSymptomReqZ = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  ageGroup: z.enum(['U5', 'O5', 'Adult']),
  briefInstruction: z.string().optional(),
  highlightedText: z.string().optional(),
  instructions: z.string().optional(),
  linkToPage: z.string().optional(),
});

export const UpdateSymptomReqZ = z.object({
  name: z.string().min(1).optional(),
  ageGroup: z.enum(['U5', 'O5', 'Adult']).optional(),
  briefInstruction: z.string().optional(),
  highlightedText: z.string().optional(),
  instructions: z.string().optional(),
  linkToPage: z.string().optional(),
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
  slug: z.string().min(1),
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
