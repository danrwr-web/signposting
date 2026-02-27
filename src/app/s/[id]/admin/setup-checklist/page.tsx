import 'server-only'
import { getSessionUser, requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { computeClinicalReviewCounts, getClinicalReviewKey } from '@/lib/clinicalReviewCounts'
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
            updatedAt: true,
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
    const onboardingUpdatedAt = surgery.onboardingProfile?.updatedAt ?? null

    // Extract appointmentModel from profileJson
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

    // Check if appointment model is configured (any archetype enabled, including clinician archetypes)
    const gpArchetypesEnabled = Object.values({
      routineContinuityGp: appointmentModel.routineContinuityGp,
      routineGpPhone: appointmentModel.routineGpPhone,
      gpTriage48h: appointmentModel.gpTriage48h,
      urgentSameDayPhone: appointmentModel.urgentSameDayPhone,
      urgentSameDayF2F: appointmentModel.urgentSameDayF2F,
      otherClinicianDirect: appointmentModel.otherClinicianDirect,
    }).some(arch => arch.enabled)
    const clinicianArchetypesEnabled = (appointmentModel.clinicianArchetypes || []).some(ca => ca.enabled)
    const appointmentModelConfigured = gpArchetypesEnabled || clinicianArchetypesEnabled

    // Calculate pendingCount using the same logic as the Clinical Review panel
    const allSymptoms = await getEffectiveSymptoms(surgeryId, true)
    const allReviewStatuses = await prisma.symptomReviewStatus.findMany({
      where: { surgeryId },
      select: { symptomId: true, ageGroup: true, status: true },
    })
    const statusMap = new Map(
      allReviewStatuses.map(rs => [getClinicalReviewKey(rs.symptomId, rs.ageGroup), rs])
    )
    const { pending: pendingCount } = computeClinicalReviewCounts(allSymptoms, statusMap as any)

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
        onboardingUpdatedAt={onboardingUpdatedAt}
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

