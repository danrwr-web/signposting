import 'server-only'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { revalidatePath } from 'next/cache'

/**
 * Updates the requiresClinicalReview flag on a surgery based on whether
 * there are any ENABLED symptoms with PENDING or CHANGES_REQUIRED review statuses.
 * The banner only shows if at least one enabled symptom requires review.
 * @param surgeryId The surgery ID to update
 * @param reviewerId Optional user ID to set as lastClinicalReviewerId when all items are approved
 */
export async function updateRequiresClinicalReview(
  surgeryId: string,
  reviewerId?: string
): Promise<void> {
  // Get only ENABLED symptoms (exclude disabled ones)
  const enabledSymptoms = await getEffectiveSymptoms(surgeryId, false) // includeDisabled = false
  
  // Build a set of enabled symptom keys (symptomId-ageGroup)
  const enabledKeys = new Set(
    enabledSymptoms.map(s => `${s.id}-${s.ageGroup || ''}`)
  )
  
  // Get all review statuses for this surgery
  const allReviewStatuses = await prisma.symptomReviewStatus.findMany({
    where: { surgeryId },
  })
  
  // Filter to only review statuses for ENABLED symptoms
  const enabledReviewStatuses = allReviewStatuses.filter(rs => {
    const key = `${rs.symptomId}-${rs.ageGroup || ''}`
    return enabledKeys.has(key)
  })
  
  // Count PENDING or CHANGES_REQUIRED statuses for enabled symptoms only
  const pendingReviewCount = enabledReviewStatuses.filter(
    rs => rs.status === 'PENDING' || rs.status === 'CHANGES_REQUIRED'
  ).length
  
  // Build a set of reviewed symptom keys (for enabled symptoms)
  const reviewedKeys = new Set(
    enabledReviewStatuses.map(rs => `${rs.symptomId}-${rs.ageGroup || ''}`)
  )
  
  // Count enabled symptoms without review statuses (implicitly pending)
  const unreviewedCount = enabledSymptoms.filter(s => {
    const key = `${s.id}-${s.ageGroup || ''}`
    return !reviewedKeys.has(key)
  }).length
  
  const hasPendingItems = pendingReviewCount > 0 || unreviewedCount > 0
  
  // Get surgery slug for revalidation
  const surgery = await prisma.surgery.findUnique({
    where: { id: surgeryId },
    select: { slug: true }
  })
  
  await prisma.surgery.update({
    where: { id: surgeryId },
    data: {
      requiresClinicalReview: hasPendingItems,
      // Clear lastClinicalReviewAt if there are still pending items
      lastClinicalReviewAt: hasPendingItems ? null : new Date(),
      lastClinicalReviewerId: hasPendingItems ? null : reviewerId || null,
    },
  })
  
  // Revalidate the page cache for this surgery
  // The route is /s/[id]/page.tsx where id is the surgeryId
  revalidatePath(`/s/${surgeryId}`)
  // Also revalidate by slug if available (in case middleware redirects)
  if (surgery?.slug) {
    revalidatePath(`/s/${surgery.slug}`)
  }
}

