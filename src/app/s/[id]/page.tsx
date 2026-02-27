import { requireSurgeryAccess, can } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCachedEffectiveSymptoms } from '@/server/effectiveSymptoms'
import HomePageClient from '@/app/HomePageClient'
import { getCommonReasonsForSurgery, UiConfig } from '@/lib/commonReasons'

// Allow Next.js to cache this page for a short window. Symptom data is already
// cached for 300s inside getCachedEffectiveSymptoms; aligning the page with a
// shorter revalidation period gives a large speed boost for repeated visits
// while keeping data reasonably fresh.
export const revalidate = 60

interface SignpostingToolPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SignpostingToolPage({ params }: SignpostingToolPageProps) {
  const { id: surgeryId } = await params

  try {
    const user = await requireSurgeryAccess(surgeryId)

    // If the user is an admin and setup is not complete, redirect to the
    // dashboard where the welcome banner is visible.
    if (can(user).manageSurgery(surgeryId)) {
      const onboarding = await prisma.surgeryOnboardingProfile.findUnique({
        where: { surgeryId },
        select: { completed: true },
      })
      if (!onboarding?.completed) {
        redirect(`/s/${surgeryId}/dashboard`)
      }
    }

    // Get surgery details including clinical review status and UI config
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

    // Get all surgeries for the surgery selector (only fields needed by the UI)
    const surgeries = await prisma.surgery.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { name: 'asc' }
    })

    // Get effective symptoms for this surgery (base + overrides + enabled custom)
    const symptoms = await getCachedEffectiveSymptoms(surgeryId)

    // Get common reasons from config or fallback
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
