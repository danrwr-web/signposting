import 'server-only'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms, type EffectiveSymptom } from '@/server/effectiveSymptoms'
import {
  computeClinicalReviewCounts,
  getClinicalReviewKey,
  type ClinicalReviewStatusLike,
} from '@/lib/clinicalReviewCounts'

/**
 * Counts the enabled symptoms for a surgery that are still awaiting clinical
 * review: explicit PENDING or CHANGES_REQUIRED statuses, plus enabled symptoms
 * with no review status record at all (implicitly pending).
 *
 * @param surgeryId The surgery to count for
 * @param preloadedEnabledSymptoms Pass the already-loaded enabled effective
 *   symptoms to avoid re-resolving them (only `id` and `ageGroup` are used)
 */
export async function countPendingClinicalReviews(
  surgeryId: string,
  preloadedEnabledSymptoms?: Array<Pick<EffectiveSymptom, 'id' | 'ageGroup'>>
): Promise<number> {
  const symptoms = preloadedEnabledSymptoms ?? await getEffectiveSymptoms(surgeryId, false)

  const reviewStatuses = await prisma.symptomReviewStatus.findMany({
    where: { surgeryId },
    select: { symptomId: true, ageGroup: true, status: true },
  })

  const statusMap = new Map<string, ClinicalReviewStatusLike>(
    reviewStatuses.map(rs => [
      getClinicalReviewKey(rs.symptomId, rs.ageGroup),
      rs as ClinicalReviewStatusLike,
    ])
  )

  const counts = computeClinicalReviewCounts(symptoms, statusMap)
  return counts.pending + counts.changesRequested
}
