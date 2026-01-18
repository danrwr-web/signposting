import type { EditorialRole } from '@/lib/schemas/editorial'

export type RoleProfile = {
  role: EditorialRole
  audience: string
  tone: string
  allowedContent: string[]
  disallowedContent: string[]
  sourcingGuidance: string[]
}

export const ROLE_PROFILES: Record<EditorialRole, RoleProfile> = {
  ADMIN: {
    role: 'ADMIN',
    audience: 'Reception and admin teams (non-clinical).',
    tone: 'Short, direct, checklist-like.',
    allowedContent: [
      'Plain-language recognition of red flags without clinical labels.',
      'Exact scripts for questions the toolkit expects admin staff to ask.',
      'Slot choice guidance using Red / Orange / Pink-Purple / Green.',
      'Escalation steps: 999, duty GP, same-day clinician, safeguarding lead.',
      'Documentation, messaging, and safe handover steps.',
      'Safety netting thresholds and when to override booking rules.',
    ],
    disallowedContent: [
      'Naming conditions or making clinical judgments.',
      'Clinical risk scales or frameworks.',
      'Management plans beyond process escalation.',
      'Prescribing or treatment advice.',
      'Clinical safety plans or counselling.',
    ],
    sourcingGuidance: [
      'Primary authority is Signposting Toolkit (internal).',
      'Only use NHS/NICE for safety-netting wording when needed.',
    ],
  },
  GP: {
    role: 'GP',
    audience: 'GPs and prescribers (clinically trained).',
    tone: 'Clinical, precise, evidence-led.',
    allowedContent: [
      'Assessment frameworks and clinical reasoning where relevant.',
      'Management and safety guidance within GP scope.',
      'Decision thresholds and escalation pathways.',
    ],
    disallowedContent: [
      'Non-evidence-based claims.',
      'Advice outside UK guidance or scope.',
    ],
    sourcingGuidance: ['Use authoritative UK clinical sources (NICE, NHS, RCGP, GMC).'],
  },
  NURSE: {
    role: 'NURSE',
    audience: 'Practice nurses and HCAs (clinical but non-prescribing).',
    tone: 'Clear, practical, and within scope.',
    allowedContent: [
      'Assessment prompts and escalation within nursing scope.',
      'Care navigation and safety advice aligned to practice policy.',
      'When to involve a GP or senior clinician.',
    ],
    disallowedContent: [
      'Prescribing instructions or medication changes.',
      'Advice outside nursing scope or local policy.',
    ],
    sourcingGuidance: ['Use authoritative UK clinical sources (NICE, NHS, RCGP).'],
  },
}

export function getRoleProfile(role: EditorialRole): RoleProfile {
  return ROLE_PROFILES[role]
}
