import type { EffectiveSymptom } from '@/server/effectiveSymptoms'

export type ClinicalReviewState = 'PENDING' | 'APPROVED' | 'CHANGES_REQUIRED'

export type ClinicalReviewStatusLike = {
  symptomId: string
  ageGroup: string | null
  status: ClinicalReviewState
}

export function getClinicalReviewKey(symptomId: string, ageGroup: string | null | undefined): string {
  return `${symptomId}-${ageGroup || ''}`
}

export function getReviewStatusForSymptom(
  symptom: Pick<EffectiveSymptom, 'id' | 'ageGroup'>,
  statusMap: Map<string, ClinicalReviewStatusLike>
): ClinicalReviewStatusLike | null {
  const keyExact = getClinicalReviewKey(symptom.id, symptom.ageGroup)
  const keyLegacyNull = getClinicalReviewKey(symptom.id, null)
  return statusMap.get(keyExact) || statusMap.get(keyLegacyNull) || null
}

/**
 * Number of pending-review symptoms at which the front-page notice switches
 * from the subtle one-line note to the prominent warning banner.
 */
export const CLINICAL_REVIEW_PROMINENT_THRESHOLD = 5

export type ClinicalReviewNoticeTier = 'none' | 'subtle' | 'prominent'

export function getClinicalReviewNoticeTier(pendingCount: number): ClinicalReviewNoticeTier {
  if (pendingCount <= 0) return 'none'
  if (pendingCount >= CLINICAL_REVIEW_PROMINENT_THRESHOLD) return 'prominent'
  return 'subtle'
}

export function computeClinicalReviewCounts(
  symptoms: Array<Pick<EffectiveSymptom, 'id' | 'ageGroup'>>,
  statusMap: Map<string, ClinicalReviewStatusLike>
): { pending: number; approved: number; changesRequested: number; all: number } {
  let pending = 0
  let approved = 0
  let changesRequested = 0

  for (const s of symptoms) {
    const rs = getReviewStatusForSymptom(s, statusMap)
    const status = rs?.status || 'PENDING'
    if (status === 'APPROVED') approved += 1
    else if (status === 'CHANGES_REQUIRED') changesRequested += 1
    else pending += 1
  }

  return { pending, approved, changesRequested, all: symptoms.length }
}

