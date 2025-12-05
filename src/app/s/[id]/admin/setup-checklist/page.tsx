import 'server-only'
import { getSessionUser, requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import SetupChecklistClient from './SetupChecklistClient'
import { AppointmentModelConfig } from '@/lib/api-contracts'

interface SetupChecklistPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SetupChecklistPage({ params }: SetupChecklistPageProps) {
  const { id: surgeryId } = await params
  
  try {
    const user = await requireSurgeryAdmin(surgeryId)
    
    // Get surgery with onboarding profile
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      include: {
        onboardingProfile: {
          select: {
            completed: true,
            completedAt: true,
            profileJson: true,
          }
        }
      }
    })

    if (!surgery) {
      redirect('/unauthorized')
    }

    // Extract onboardingProfile data
    const onboardingCompleted = surgery.onboardingProfile?.completed ?? false
    const onboardingCompletedAt = surgery.onboardingProfile?.completedAt ?? null

    // Extract appointmentModel from profileJson
    const profileJson = surgery.onboardingProfile?.profileJson as any
    const appointmentModel: AppointmentModelConfig = profileJson?.appointmentModel || {
      routineContinuityGp: { enabled: false, localName: '', clinicianRole: '', description: '' },
      routineGpPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
      gpTriage48h: { enabled: false, localName: '', clinicianRole: '', description: '' },
      urgentSameDayPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
      urgentSameDayF2F: { enabled: false, localName: '', clinicianRole: '', description: '' },
      otherClinicianDirect: { enabled: false, localName: '', clinicianRole: '', description: '' },
    }

    // Check if appointment model is configured (any archetype enabled)
    const appointmentModelConfigured = Object.values(appointmentModel).some(arch => arch.enabled)

    // Calculate pendingCount from SymptomReviewStatus
    const enabledSymptoms = await getEffectiveSymptoms(surgeryId, false)
    const allReviewStatuses = await prisma.symptomReviewStatus.findMany({
      where: { surgeryId },
    })

    const reviewedSymptomKeys = new Set(
      allReviewStatuses.map(rs => `${rs.symptomId}-${rs.ageGroup || ''}`)
    )
    const unreviewedCount = enabledSymptoms.filter(s => {
      const key = `${s.id}-${s.ageGroup || ''}`
      return !reviewedSymptomKeys.has(key)
    }).length
    const explicitPendingCount = allReviewStatuses.filter(rs => rs.status === 'PENDING').length
    const pendingCount = unreviewedCount + explicitPendingCount

    // Check if AI customisation has occurred
    // Get all symptom IDs for this surgery (base symptoms with overrides + custom symptoms)
    const baseSymptomIds = new Set(
      (await prisma.surgerySymptomOverride.findMany({
        where: { surgeryId },
        select: { baseSymptomId: true }
      })).map(o => o.baseSymptomId)
    )
    const customSymptomIds = new Set(
      (await prisma.surgeryCustomSymptom.findMany({
        where: { surgeryId, isDeleted: false },
        select: { id: true }
      })).map(c => c.id)
    )

    // Check if any SymptomHistory records exist with modelUsed set (indicating AI was used)
    // Note: SymptomHistory doesn't have a "reason" field, so we check for modelUsed being set
    const allSymptomIds = [...baseSymptomIds, ...customSymptomIds]
    let aiCustomisationOccurred = false
    if (allSymptomIds.length > 0) {
      const aiHistoryRecord = await prisma.symptomHistory.findFirst({
        where: {
          symptomId: { in: Array.from(allSymptomIds) },
          modelUsed: { not: null },
          NOT: {
            modelUsed: 'REVERT'
          }
        }
      })
      aiCustomisationOccurred = aiHistoryRecord !== null
    }

    return (
      <SetupChecklistClient
        surgeryId={surgeryId}
        surgeryName={surgery.name}
        onboardingCompleted={onboardingCompleted}
        onboardingCompletedAt={onboardingCompletedAt}
        appointmentModelConfigured={appointmentModelConfigured}
        aiCustomisationOccurred={aiCustomisationOccurred}
        pendingCount={pendingCount}
        standalone={true}
      />
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}

