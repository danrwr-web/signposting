import 'server-only'

export const HIGH_RISK_TAG = 'highrisk'

export function getHighRiskSurgeryTag(surgeryId: string): string {
  return `highrisk:${surgeryId}`
}

