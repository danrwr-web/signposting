import { getSessionUser, requireSurgeryAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCachedEffectiveSymptoms } from '@/server/effectiveSymptoms'
import HomePageClient from '@/app/HomePageClient'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { getCommonReasonsForSurgery, UiConfig } from '@/lib/commonReasons'

// Disable caching for this page to ensure fresh requiresClinicalReview data
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface SignpostingToolPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SignpostingToolPage({ params }: SignpostingToolPageProps) {
  const { id: surgeryId } = await params
  
  try {
    const user = await requireSurgeryAccess(surgeryId)
    
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

    // Get all surgeries for the surgery selector
    const surgeries = await prisma.surgery.findMany({
      orderBy: { name: 'asc' }
    })

    // Get effective symptoms for this surgery (base + overrides + enabled custom)
    const symptoms = await getCachedEffectiveSymptoms(surgeryId)

    // Get common reasons from config or fallback
    const commonReasonsItems = getCommonReasonsForSurgery(
      surgery.uiConfig as UiConfig | null,
      symptoms
    )

    const workflowGuidanceEnabled = await isFeatureEnabledForSurgery(surgeryId, 'workflow_guidance')

    return (
      <HomePageClient
        surgeries={surgeries}
        symptoms={symptoms}
        requiresClinicalReview={surgery.requiresClinicalReview}
        surgeryName={surgery.name}
        workflowGuidanceEnabled={workflowGuidanceEnabled}
        surgeryId={surgeryId}
        commonReasonsItems={commonReasonsItems}
      />
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}
