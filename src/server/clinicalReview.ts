import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms, type EffectiveSymptom } from '@/server/effectiveSymptoms'
import {
  computeClinicalReviewCounts,
  getClinicalReviewKey,
  type ClinicalReviewStatusLike,
} from '@/lib/clinicalReviewCounts'

/**
 * The upsert that moves a symptom to PENDING review, as arguments rather than a
 * call. Callers that must reset the approval in the *same* transaction as the
 * content write (so a failure can never leave new content sitting behind a
 * stale APPROVED status) pass this to `tx.symptomReviewStatus.upsert(...)` and
 * then run `updateRequiresClinicalReview` afterwards.
 *
 * `markSymptomPendingReview` below is the convenience wrapper for callers that
 * do not need that guarantee.
 */
export function symptomPendingReviewUpsertArgs(
  surgeryId: string,
  symptomId: string,
  ageGroup: string | null | undefined
): Prisma.SymptomReviewStatusUpsertArgs {
  const normalizedAgeGroup = (ageGroup || null) as unknown as string
  return {
    where: {
      surgeryId_symptomId_ageGroup: {
        surgeryId,
        symptomId,
        ageGroup: normalizedAgeGroup,
      },
    },
    create: {
      surgeryId,
      symptomId,
      ageGroup: normalizedAgeGroup,
      status: 'PENDING',
      lastReviewedAt: null,
    },
    update: {
      status: 'PENDING',
      lastReviewedAt: null,
    },
  }
}

/**
 * Marks a symptom as awaiting clinical review for a surgery after its content
 * changed (instructions, notices or variants), and refreshes the surgery's
 * requiresClinicalReview flag. Used by the manual practice edit paths; the AI
 * customise route has its own transactional equivalent.
 */
export async function markSymptomPendingReview(
  surgeryId: string,
  symptomId: string,
  ageGroup: string | null | undefined
): Promise<void> {
  await prisma.symptomReviewStatus.upsert(
    symptomPendingReviewUpsertArgs(surgeryId, symptomId, ageGroup)
  )
  const { updateRequiresClinicalReview } = await import('@/server/updateRequiresClinicalReview')
  await updateRequiresClinicalReview(surgeryId)
}

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
