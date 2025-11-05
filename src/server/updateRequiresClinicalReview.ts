import 'server-only'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'

/**
 * Updates the requiresClinicalReview flag on a surgery based on whether
 * there are any PENDING or CHANGES_REQUIRED review statuses.
 * @param surgeryId The surgery ID to update
 * @param reviewerId Optional user ID to set as lastClinicalReviewerId when all items are approved
 */
export async function updateRequiresClinicalReview(
  surgeryId: string,
  reviewerId?: string
): Promise<void> {
  // Check if there are any PENDING or CHANGES_REQUIRED review statuses
  const pendingReviewCount = await prisma.symptomReviewStatus.count({
    where: {
      surgeryId,
      status: { in: ['PENDING', 'CHANGES_REQUIRED'] },
    },
  })
  
  // Also check if there are symptoms without review statuses (implicitly pending)
  const totalSymptoms = await getEffectiveSymptoms(surgeryId, true)
  const reviewedKeys = new Set(
    (await prisma.symptomReviewStatus.findMany({
      where: { surgeryId },
      select: { symptomId: true, ageGroup: true },
    })).map(rs => `${rs.symptomId}-${rs.ageGroup || ''}`)
  )
  const unreviewedCount = totalSymptoms.filter(s => {
    const key = `${s.id}-${s.ageGroup || ''}`
    return !reviewedKeys.has(key)
  }).length
  
  const hasPendingItems = pendingReviewCount > 0 || unreviewedCount > 0
  
  await prisma.surgery.update({
    where: { id: surgeryId },
    data: {
      requiresClinicalReview: hasPendingItems,
      // Clear lastClinicalReviewAt if there are still pending items
      lastClinicalReviewAt: hasPendingItems ? null : new Date(),
      lastClinicalReviewerId: hasPendingItems ? null : reviewerId || null,
    },
  })
}

