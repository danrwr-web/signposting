import { getSessionUser, requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AppointmentModelConfig } from '@/lib/api-contracts'
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
            profileJson: true,
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

    // Extract appointmentModel from profileJson with defaults
    const profileJson = surgery.onboardingProfile?.profileJson as any
    const appointmentModel: AppointmentModelConfig = profileJson?.appointmentModel || {
      routineContinuityGp: { enabled: false, localName: '', clinicianRole: '', description: '' },
      routineGpPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
      gpTriage48h: { enabled: false, localName: '', clinicianRole: '', description: '' },
      urgentSameDayPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
      urgentSameDayF2F: { enabled: false, localName: '', clinicianRole: '', description: '' },
      otherClinicianDirect: { enabled: false, localName: '', clinicianRole: '', description: '' },
      clinicianArchetypes: [],
    }

    return (
      <AISetupClient
        surgeryId={surgeryId}
        surgeryName={surgery.name}
        onboardingCompleted={surgery.onboardingProfile?.completed ?? false}
        featureEnabled={!!featureFlag}
        appointmentModel={appointmentModel}
        user={user}
      />
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}

