import { requireSurgeryAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCachedEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { countPendingClinicalReviews } from '@/server/clinicalReview'
import HomePageClient from '@/app/HomePageClient'
import { getCommonReasonsForSurgery, UiConfig } from '@/lib/commonReasons'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { FEATURE_HIDE_AGE_BANDS } from '@/lib/featureKeys'

export const revalidate = 60

interface SignpostingPageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * Direct signposting tool route — always renders the tool without
 * the admin-setup redirect that /s/[id] performs. Used by the
 * "Launch Signposting Tool" link on the dashboard.
 */
export default async function SignpostingPage({ params }: SignpostingPageProps) {
  const { id: surgeryId } = await params

  try {
    await requireSurgeryAccess(surgeryId)

    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: {
        id: true,
        name: true,
        slug: true,
        uiConfig: true,
      }
    })

    if (!surgery) {
      redirect('/unauthorized')
    }

    const surgeries = await prisma.surgery.findMany({
      select: { id: true, slug: true, name: true, surgeryType: true },
      orderBy: { name: 'asc' }
    })

    const symptoms = await getCachedEffectiveSymptoms(surgeryId)

    const pendingClinicalReviewCount = await countPendingClinicalReviews(surgeryId, symptoms)

    const commonReasonsItems = getCommonReasonsForSurgery(
      surgery.uiConfig as UiConfig | null,
      symptoms
    )

    // Per-surgery display option: hide the Under-5 / 5–17 / Adult filter and badges
    const hideAgeBands = await isFeatureEnabledForSurgery(surgeryId, FEATURE_HIDE_AGE_BANDS)

    return (
      <HomePageClient
        surgeries={surgeries}
        symptoms={symptoms}
        pendingClinicalReviewCount={pendingClinicalReviewCount}
        surgeryName={surgery.name}
        surgeryId={surgeryId}
        commonReasonsItems={commonReasonsItems}
        hideAgeBands={hideAgeBands}
      />
    )
  } catch (error) {
    // Don't catch NEXT_REDIRECT errors - let them propagate
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof error.digest === 'string' &&
      error.digest.startsWith('NEXT_REDIRECT')
    ) {
      throw error
    }
    redirect('/unauthorized')
  }
}
