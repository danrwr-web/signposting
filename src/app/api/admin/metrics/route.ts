import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, can } from '@/lib/rbac'
import { AppointmentModelConfig } from '@/lib/api-contracts'

export const runtime = 'nodejs'

function ensureAppointmentModel(profileJson: any): AppointmentModelConfig {
  return profileJson?.appointmentModel || {
    routineContinuityGp: { enabled: false, localName: '', clinicianRole: '', description: '' },
    routineGpPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
    gpTriage48h: { enabled: false, localName: '', clinicianRole: '', description: '' },
    urgentSameDayPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
    urgentSameDayF2F: { enabled: false, localName: '', clinicianRole: '', description: '' },
    otherClinicianDirect: { enabled: false, localName: '', clinicianRole: '', description: '' },
  }
}

// GET /api/admin/metrics?surgeryId=...
// Returns pending review, suggestions pending, and setup checklist outstanding counts.
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')

    if (!surgeryId) {
      return NextResponse.json({ error: 'surgeryId is required' }, { status: 400 })
    }

    const isSuperuser = can(user).isSuperuser()
    const isAdminForSurgery = can(user).manageSurgery(surgeryId)

    if (!isSuperuser && !isAdminForSurgery) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Pending clinical review count (PENDING only)
    const pendingReviewCount = await prisma.symptomReviewStatus.count({
      where: {
        surgeryId,
        status: 'PENDING',
      },
    })

    // Suggestions pending count (replicates Suggestions API logic for pending)
    const suggestions = await prisma.suggestion.findMany({
      where: {
        surgeryId,
      },
      select: {
        text: true,
      },
    })

    const suggestionsPendingCount = suggestions.reduce((acc, suggestion) => {
      let status = 'pending'
      try {
        const parsed = JSON.parse(suggestion.text)
        if (parsed?.status) {
          status = parsed.status
        }
      } catch {
        status = 'pending'
      }
      return acc + (status === 'pending' ? 1 : 0)
    }, 0)

    // Onboarding profile and appointment model
    const onboardingProfile = await prisma.surgeryOnboardingProfile.findUnique({
      where: { surgeryId },
      select: {
        completed: true,
        profileJson: true,
      },
    })

    const onboardingCompleted = onboardingProfile?.completed ?? false
    const appointmentModel = ensureAppointmentModel(onboardingProfile?.profileJson)
    const appointmentModelConfigured = Object.values(appointmentModel).some((arch) => arch.enabled)

    // AI customisation check: any SymptomHistory with modelUsed set (non-null and not 'REVERT') for this surgery's symptoms
    const overrideSymptomIds = await prisma.surgerySymptomOverride.findMany({
      where: { surgeryId },
      select: { baseSymptomId: true },
    })
    const customSymptomIds = await prisma.surgeryCustomSymptom.findMany({
      where: { surgeryId, isDeleted: false },
      select: { id: true },
    })

    const symptomIds = [
      ...overrideSymptomIds.map((o) => o.baseSymptomId),
      ...customSymptomIds.map((c) => c.id),
    ].filter(Boolean)

    let aiCustomisationOccurred = false
    if (symptomIds.length > 0) {
      const historyRecord = await prisma.symptomHistory.findFirst({
        where: {
          symptomId: { in: symptomIds },
          modelUsed: {
            not: null,
            notIn: ['REVERT'],
          },
        },
        select: { id: true },
      })
      aiCustomisationOccurred = !!historyRecord
    }

    // Setup checklist outstanding count
    let setupChecklistOutstandingCount = 0
    if (!onboardingCompleted) setupChecklistOutstandingCount += 1
    if (!appointmentModelConfigured) setupChecklistOutstandingCount += 1
    if (!aiCustomisationOccurred) setupChecklistOutstandingCount += 1
    if (pendingReviewCount > 0) setupChecklistOutstandingCount += 1

    return NextResponse.json({
      pendingReviewCount,
      suggestionsPendingCount,
      setupChecklistOutstandingCount,
    })
  } catch (error) {
    console.error('Error loading admin metrics:', error)
    return NextResponse.json({ error: 'Failed to load metrics' }, { status: 500 })
  }
}

