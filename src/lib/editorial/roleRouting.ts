import type { EditorialRole } from '@/lib/schemas/editorial'

const ADMIN_KEYWORDS = [
  'admin',
  'reception',
  'front desk',
  'care navigator',
  'care navigation',
  'signposting',
  'triage',
  'slot',
  'booking',
]

const GP_KEYWORDS = ['gp', 'general practitioner', 'doctor', 'prescriber', 'clinician']

const NURSE_KEYWORDS = ['nurse', 'hca', 'health care assistant', 'healthcare assistant']

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

export function inferRoleFromPrompt(promptText: string): EditorialRole | null {
  const lower = promptText.toLowerCase()
  if (includesAny(lower, GP_KEYWORDS)) return 'GP'
  if (includesAny(lower, NURSE_KEYWORDS)) return 'NURSE'
  if (includesAny(lower, ADMIN_KEYWORDS)) return 'ADMIN'
  return null
}

export function resolveTargetRole(params: {
  promptText: string
  requestedRole: EditorialRole
}): EditorialRole {
  if (params.requestedRole !== 'ADMIN') {
    return params.requestedRole
  }
  return inferRoleFromPrompt(params.promptText) ?? params.requestedRole
}
