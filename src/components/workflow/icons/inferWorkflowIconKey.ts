import { DEFAULT_WORKFLOW_ICON_KEY, type WorkflowIconKey } from './workflowIconRegistry'

function normaliseText(input: string) {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function includesAny(haystack: string, needles: readonly string[]) {
  return needles.some((n) => haystack.includes(n))
}

export function inferWorkflowIconKey(input: {
  name: string
  description?: string | null
}): WorkflowIconKey {
  const name = normaliseText(input.name || '')
  const description = normaliseText(input.description || '')

  // Prioritise name first; fall back to description.
  const text = `${name} ${description}`.trim()

  // Safety / sensitive / licensing
  if (includesAny(text, ['firearm', 'firearms', 'licensing', 'license'])) return 'shieldCheck'
  // Avoid overly-short keywords (e.g. "dv") which can collide with unrelated words (e.g. "advice").
  if (includesAny(text, ['safeguard', 'child protection', 'adult protection', 'domestic violence'])) return 'shield'
  if (includesAny(text, ['confidential', 'security', 'secure'])) return 'lock'
  if (includesAny(text, ['urgent', 'red flag', 'high risk', 'warning', 'triage'])) return 'warning'

  // Tests / results
  if (includesAny(text, ['blood test', 'pathology', 'lab', 'results', 'result'])) return 'beaker'

  // Discharge / incoming documents
  if (includesAny(text, ['discharge', 'd c summary', 'dc summary', 'summary'])) return 'arrowDownTray'

  // Advice & guidance / messages
  if (includesAny(text, ['advice and guidance', 'a and g', 'guidance', 'advice'])) return 'chat'

  // Letters / correspondence
  if (includesAny(text, ['clinic letter', 'clinic letters', 'letter', 'correspondence'])) return 'envelope'

  // Reviews
  if (includesAny(text, ['gp review', 'clinician review', 'doctor review', 'review'])) return 'clipboard'

  // Referrals / forwarding
  if (includesAny(text, ['referral', 'refer', 'send', 'forward'])) return 'paperAirplane'

  // Meds
  if (includesAny(text, ['prescription', 'repeat', 'medication', 'meds', 'medicine'])) return 'pill'

  // Private/insurance/medico-legal
  if (includesAny(text, ['private', 'insurance', 'medico legal', 'medicolegal'])) return 'briefcase'

  // Default
  return DEFAULT_WORKFLOW_ICON_KEY
}

