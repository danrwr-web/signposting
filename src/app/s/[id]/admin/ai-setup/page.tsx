import { getSessionUser, requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AISetupClient from './AISetupClient'

interface AISetupPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function AISetupPage({ params }: AISetupPageProps) {
  const { id: surgeryId } = await params

  try {
    const user = await requireSurgeryAdmin(surgeryId)

    // Get surgery details with onboarding profile and feature flags
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: {
        id: true,
        name: true,
        onboardingProfile: {
          select: {
            completed: true,
            completedAt: true,
          },
        },
        surgeryFeatureFlags: {
          include: {
            feature: true,
          },
        },
      },
    })

    if (!surgery) {
      redirect('/unauthorized')
    }

    // Check if feature flag is enabled
    const featureFlag = surgery.surgeryFeatureFlags.find(
      (f) => f.feature.key === 'ai_surgery_customisation' && f.enabled
    )

    return (
      <AISetupClient
        surgeryId={surgeryId}
        surgeryName={surgery.name}
        onboardingCompleted={surgery.onboardingProfile?.completed ?? false}
        featureEnabled={!!featureFlag}
        user={user}
      />
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}

