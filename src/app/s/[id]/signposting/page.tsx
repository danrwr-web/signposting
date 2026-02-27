import { requireSurgeryAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCachedEffectiveSymptoms } from '@/server/effectiveSymptoms'
import HomePageClient from '@/app/HomePageClient'
import { getCommonReasonsForSurgery, UiConfig } from '@/lib/commonReasons'

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
        requiresClinicalReview: true,
        uiConfig: true,
      }
    })

    if (!surgery) {
      redirect('/unauthorized')
    }

    const surgeries = await prisma.surgery.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { name: 'asc' }
    })

    const symptoms = await getCachedEffectiveSymptoms(surgeryId)

    const commonReasonsItems = getCommonReasonsForSurgery(
      surgery.uiConfig as UiConfig | null,
      symptoms
    )

    return (
      <HomePageClient
        surgeries={surgeries}
        symptoms={symptoms}
        requiresClinicalReview={surgery.requiresClinicalReview}
        surgeryName={surgery.name}
        surgeryId={surgeryId}
        commonReasonsItems={commonReasonsItems}
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
