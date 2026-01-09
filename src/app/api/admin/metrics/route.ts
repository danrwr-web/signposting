import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, can } from '@/lib/rbac'
import { AppointmentModelConfig } from '@/lib/api-contracts'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { unstable_noStore as noStore } from 'next/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

function ensureAppointmentModel(profileJson: any): AppointmentModelConfig {
  return profileJson?.appointmentModel || {
    routineContinuityGp: { enabled: false, localName: '', clinicianRole: '', description: '' },
    routineGpPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
    gpTriage48h: { enabled: false, localName: '', clinicianRole: '', description: '' },
    urgentSameDayPhone: { enabled: false, localName: '', clinicianRole: '', description: '' },
    urgentSameDayF2F: { enabled: false, localName: '', clinicianRole: '', description: '' },
    otherClinicianDirect: { enabled: false, localName: '', clinicianRole: '', description: '' },
    clinicianArchetypes: [],
  }
}

// GET /api/admin/metrics?surgeryId=...
// Returns pending review, suggestions pending, and setup checklist outstanding counts.
export async function GET(request: NextRequest) {
  try {
    // Always compute fresh counts for badges.
    noStore()

    const user = await getSessionUser()
    if (!user) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      res.headers.set('Cache-Control', 'no-store')
      return res
    }

    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')

    if (!surgeryId) {
      const res = NextResponse.json({ error: 'surgeryId is required' }, { status: 400 })
      res.headers.set('Cache-Control', 'no-store')
      return res
    }

    const isSuperuser = can(user).isSuperuser()
    const isAdminForSurgery = can(user).manageSurgery(surgeryId)

    if (!isSuperuser && !isAdminForSurgery) {
      const res = NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      res.headers.set('Cache-Control', 'no-store')
      return res
    }

    // Pending clinical review count:
    // - symptoms with no review status are treated as pending
    // - symptoms with explicit status=PENDING are pending
    // (Matches how the Clinical Review UI calculates "Pending".)
    const symptomsForReview = await getEffectiveSymptoms(surgeryId, true)
    const allReviewStatuses = await prisma.symptomReviewStatus.findMany({
      where: {
        surgeryId,
      },
      select: { symptomId: true, ageGroup: true, status: true },
    })
    const symptomKeys = new Set(symptomsForReview.map((s) => `${s.id}-${s.ageGroup || ''}`))
    const reviewedKeys = new Set(allReviewStatuses.map((rs) => `${rs.symptomId}-${rs.ageGroup || ''}`))
    const unreviewedCount = symptomsForReview.filter((s) => {
      const key = `${s.id}-${s.ageGroup || ''}`
      return !reviewedKeys.has(key)
    }).length
    const explicitPendingCount = allReviewStatuses.filter((rs) => {
      if (rs.status !== 'PENDING') return false
      const key = `${rs.symptomId}-${rs.ageGroup || ''}`
      // Ignore review-status rows for symptoms that no longer exist (e.g. deleted customs).
      return symptomKeys.has(key)
    }).length
    const pendingReviewCount = unreviewedCount + explicitPendingCount

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
    // Check if appointment model is configured (any archetype enabled, including clinician archetypes)
    const gpArchetypesEnabled = Object.values({
      routineContinuityGp: appointmentModel.routineContinuityGp,
      routineGpPhone: appointmentModel.routineGpPhone,
      gpTriage48h: appointmentModel.gpTriage48h,
      urgentSameDayPhone: appointmentModel.urgentSameDayPhone,
      urgentSameDayF2F: appointmentModel.urgentSameDayF2F,
      otherClinicianDirect: appointmentModel.otherClinicianDirect,
    }).some((arch) => arch.enabled)
    const clinicianArchetypesEnabled = (appointmentModel.clinicianArchetypes || []).some((ca) => ca.enabled)
    const appointmentModelConfigured = gpArchetypesEnabled || clinicianArchetypesEnabled

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

    const res = NextResponse.json({
      pendingReviewCount,
      suggestionsPendingCount,
      setupChecklistOutstandingCount,
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error) {
    console.error('Error loading admin metrics:', error)
    const res = NextResponse.json({ error: 'Failed to load metrics' }, { status: 500 })
    res.headers.set('Cache-Control', 'no-store')
    return res
  }
}

