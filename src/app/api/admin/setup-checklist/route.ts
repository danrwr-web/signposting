import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { AppointmentModelConfig } from '@/lib/api-contracts'

export const runtime = 'nodejs'

// GET /api/admin/setup-checklist?surgeryId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')

    if (!surgeryId) {
      return NextResponse.json(
        { error: 'surgeryId is required' },
        { status: 400 }
      )
    }

    // Check permissions
    await requireSurgeryAdmin(surgeryId)

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
      return NextResponse.json(
        { error: 'Surgery not found' },
        { status: 404 }
      )
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

    // Determine if onboarding has been meaningfully started
    const profileSurgeryName = profileJson?.surgeryName
    const onboardingStarted = !!(surgery.onboardingProfile && (profileSurgeryName || appointmentModelConfigured))
    const onboardingUpdatedAt = surgery.onboardingProfile?.updatedAt ?? null

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

    return NextResponse.json({
      surgeryId,
      surgeryName: surgery.name,
      onboardingCompleted,
      onboardingCompletedAt,
      onboardingStarted,
      onboardingUpdatedAt,
      appointmentModelConfigured,
      aiCustomisationOccurred,
      pendingCount,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching setup checklist data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch setup checklist data' },
      { status: 500 }
    )
  }
}

