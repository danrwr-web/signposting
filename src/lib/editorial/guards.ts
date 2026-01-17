import type { EditorialRisk } from '@/lib/schemas/editorial'

const HIGH_RISK_TERMS = [
  'suicide',
  'self-harm',
  'self harm',
  'overdose',
  'chest pain',
  'stroke',
  'tia',
  'transient ischaemic attack',
  'meningitis',
  'sepsis',
  'anaphylaxis',
  'red slot',
  'blue light',
  '999',
]

const UK_SOURCE_HOSTS = [
  'nhs.uk',
  'nice.org.uk',
  'ukhsa.gov.uk',
  'gov.uk',
  'rcgp.org.uk',
  'gmc-uk.org',
  'mhra.gov.uk',
]

export function inferRiskLevel(input: string): EditorialRisk {
  const lower = input.toLowerCase()
  if (HIGH_RISK_TERMS.some((term) => lower.includes(term))) {
    return 'HIGH'
  }
  return 'LOW'
}

export function shouldRequireClinicianApproval(riskLevel: EditorialRisk): boolean {
  return riskLevel === 'HIGH'
}

export function resolveNeedsSourcing(sources: Array<{ url?: string; title?: string }>, modelFlag: boolean): boolean {
  if (modelFlag) return true
  if (!sources || sources.length === 0) return true
  const hasUkSource = sources.some((source) => {
    if (!source.url) return false
    return UK_SOURCE_HOSTS.some((host) => source.url?.includes(host))
  })
  return !hasUkSource
}
