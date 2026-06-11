import 'server-only'
import { prisma } from '@/lib/prisma'
import { countPendingClinicalReviews } from '@/server/clinicalReview'
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
  const pendingCount = await countPendingClinicalReviews(surgeryId)
  const hasPendingItems = pendingCount > 0

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
  revalidatePath(`/s/${surgeryId}/signposting`)
  // Also revalidate by slug if available (in case middleware redirects)
  if (surgery?.slug) {
    revalidatePath(`/s/${surgery.slug}`)
    revalidatePath(`/s/${surgery.slug}/signposting`)
  }
}

