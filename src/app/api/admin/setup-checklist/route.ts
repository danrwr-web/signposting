import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { AppointmentModelConfig } from '@/lib/api-contracts'
import { computeClinicalReviewCounts, getClinicalReviewKey } from '@/lib/clinicalReviewCounts'

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

    // Get surgery with onboarding profile and config fields
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

    // Calculate pendingCount using the same logic as the Clinical Review panel
    const allSymptoms = await getEffectiveSymptoms(surgeryId, true)
    const allReviewStatuses = await prisma.symptomReviewStatus.findMany({
      where: { surgeryId },
      select: { symptomId: true, ageGroup: true, status: true },
    })
    const statusMap = new Map(
      allReviewStatuses.map(rs => [getClinicalReviewKey(rs.symptomId, rs.ageGroup), rs])
    )
    const reviewCounts = computeClinicalReviewCounts(allSymptoms, statusMap as any)
    const pendingCount = reviewCounts.pending

    // Check if AI customisation has occurred
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

    // --- New checklist queries (run in parallel) ---
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [
      standardUsersCount,
      highRiskLinksCount,
      customHighlightCount,
      appointmentTypeCount,
      handbookItemCount,
      // Health dashboard queries
      activeUserGroups,
      totalViewsLast30,
      topSymptomRaw,
      lastReviewActivity,
      recentlyUpdatedCount,
    ] = await Promise.all([
      // Standard users (non-admin members)
      prisma.userSurgery.count({
        where: { surgeryId, role: { not: 'ADMIN' } }
      }),
      // High-risk links count
      prisma.highRiskLink.count({
        where: { surgeryId }
      }),
      // Custom highlight rules count
      prisma.highlightRule.count({
        where: { surgeryId }
      }),
      // Appointment types count
      prisma.appointmentType.count({
        where: { surgeryId }
      }),
      // Practice handbook items count (non-deleted)
      prisma.adminItem.count({
        where: { surgeryId, deletedAt: null }
      }),
      // Active users last 30 days (distinct userEmail from engagement events)
      prisma.engagementEvent.groupBy({
        by: ['userEmail'],
        where: { surgeryId, createdAt: { gte: thirtyDaysAgo }, userEmail: { not: null } }
      }).then(r => r.length).catch(() => 0),
      // Total symptom views last 30 days
      prisma.engagementEvent.count({
        where: { surgeryId, createdAt: { gte: thirtyDaysAgo }, event: 'view_symptom' }
      }).catch(() => 0),
      // Most viewed symptom last 30 days
      prisma.engagementEvent.groupBy({
        by: ['baseId'],
        where: { surgeryId, createdAt: { gte: thirtyDaysAgo }, event: 'view_symptom' },
        _count: { baseId: true },
        orderBy: { _count: { baseId: 'desc' } },
        take: 1
      }).catch(() => [] as Array<{ baseId: string; _count: { baseId: number } }>),
      // Last clinical review activity
      prisma.symptomReviewStatus.findFirst({
        where: { surgeryId, lastReviewedAt: { not: null } },
        orderBy: { lastReviewedAt: 'desc' },
        select: { lastReviewedAt: true }
      }).catch(() => null),
      // Symptoms reviewed in last 30 days
      prisma.symptomReviewStatus.count({
        where: { surgeryId, lastReviewedAt: { gte: thirtyDaysAgo } }
      }).catch(() => 0),
    ])

    // Derive high-risk configured status
    const highRiskConfigured = highRiskLinksCount > 0 || surgery.enableDefaultHighRisk

    // Derive highlights enabled status
    const highlightsEnabled = surgery.enableBuiltInHighlights || customHighlightCount > 0

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
      checklist: {
        onboardingCompleted,
        appointmentModelConfigured,
        aiCustomisationRun: aiCustomisationOccurred,
        pendingReviewCount: pendingCount,
        standardUsersCount,
        highRiskConfigured,
        highlightsEnabled,
        appointmentTypeCount,
        handbookItemCount,
      },
      health: {
        pendingReviewCount: pendingCount,
        changesRequestedCount: reviewCounts.changesRequested,
        lastReviewActivity: lastReviewActivity?.lastReviewedAt ?? null,
        activeUsersLast30: activeUserGroups,
        totalViewsLast30,
        topSymptomId: (topSymptomRaw as Array<{ baseId: string; _count: { baseId: number } }>)[0]?.baseId ?? null,
        topSymptomCount: (topSymptomRaw as Array<{ baseId: string; _count: { baseId: number } }>)[0]?._count?.baseId ?? 0,
        approvedCount: reviewCounts.approved,
        recentlyUpdatedCount,
      }
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
