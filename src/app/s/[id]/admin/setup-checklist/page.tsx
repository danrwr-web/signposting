import 'server-only'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { computeClinicalReviewCounts, getClinicalReviewKey } from '@/lib/clinicalReviewCounts'
import { isFeatureEnabledForSurgery } from '@/lib/features'
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

    // Check if appointment model is configured
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

    // Calculate review counts using the shared utility
    const allSymptoms = await getEffectiveSymptoms(surgeryId, true)
    const allReviewStatuses = await prisma.symptomReviewStatus.findMany({
      where: { surgeryId },
      select: { symptomId: true, ageGroup: true, status: true },
    })
    const statusMap = new Map(
      allReviewStatuses.map(rs => [getClinicalReviewKey(rs.symptomId, rs.ageGroup), rs])
    )
    const reviewCounts = computeClinicalReviewCounts(allSymptoms, statusMap as any)

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
          NOT: { modelUsed: 'REVERT' }
        }
      })
      aiCustomisationOccurred = aiHistoryRecord !== null
    }

    // New queries for enhanced checklist (run in parallel)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [
      standardUsersCount,
      highRiskLinksCount,
      customHighlightCount,
      appointmentTypeCount,
      handbookItemCount,
      aiFeatureEnabled,
      handbookFeatureEnabled,
      // Health dashboard queries
      activeUserGroups,
      totalViewsLast30,
      lastReviewActivity,
      recentlyUpdatedCount,
    ] = await Promise.all([
      prisma.userSurgery.count({
        where: { surgeryId, role: { not: 'ADMIN' } }
      }),
      prisma.highRiskLink.count({
        where: { surgeryId }
      }),
      prisma.highlightRule.count({
        where: { surgeryId }
      }),
      prisma.appointmentType.count({
        where: { surgeryId }
      }),
      prisma.adminItem.count({
        where: { surgeryId, deletedAt: null }
      }),
      isFeatureEnabledForSurgery(surgeryId, 'ai_surgery_customisation'),
      isFeatureEnabledForSurgery(surgeryId, 'admin_toolkit'),
      // Health data
      prisma.engagementEvent.groupBy({
        by: ['userEmail'],
        where: { surgeryId, createdAt: { gte: thirtyDaysAgo }, userEmail: { not: null } }
      }).then(r => r.length).catch(() => 0),
      prisma.engagementEvent.count({
        where: { surgeryId, createdAt: { gte: thirtyDaysAgo }, event: 'view_symptom' }
      }).catch(() => 0),
      prisma.symptomReviewStatus.findFirst({
        where: { surgeryId, lastReviewedAt: { not: null } },
        orderBy: { lastReviewedAt: 'desc' },
        select: { lastReviewedAt: true }
      }).catch(() => null),
      prisma.symptomReviewStatus.count({
        where: { surgeryId, lastReviewedAt: { gte: thirtyDaysAgo } }
      }).catch(() => 0),
    ])

    const highRiskConfigured = highRiskLinksCount > 0 || surgery.enableDefaultHighRisk
    const highlightsEnabled = surgery.enableBuiltInHighlights || customHighlightCount > 0

    // Build features array
    const enabledFeatures: string[] = []
    if (aiFeatureEnabled) enabledFeatures.push('ai_surgery_customisation')
    if (handbookFeatureEnabled) enabledFeatures.push('admin_toolkit')

    return (
      <SetupChecklistClient
        surgeryId={surgeryId}
        surgeryName={surgery.name}
        checklist={{
          onboardingCompleted,
          appointmentModelConfigured,
          aiCustomisationRun: aiCustomisationOccurred,
          pendingReviewCount: reviewCounts.pending,
          standardUsersCount,
          highRiskConfigured,
          highlightsEnabled,
          appointmentTypeCount,
          handbookItemCount,
        }}
        health={{
          pendingReviewCount: reviewCounts.pending,
          changesRequestedCount: reviewCounts.changesRequested,
          lastReviewActivity: lastReviewActivity?.lastReviewedAt?.toISOString() ?? null,
          activeUsersLast30: activeUserGroups as number,
          totalViewsLast30: totalViewsLast30 as number,
          topSymptomId: null,
          topSymptomCount: 0,
          approvedCount: reviewCounts.approved,
          recentlyUpdatedCount: recentlyUpdatedCount as number,
        }}
        features={enabledFeatures}
        onboardingCompletedAt={onboardingCompletedAt?.toISOString() ?? null}
        onboardingUpdatedAt={onboardingUpdatedAt?.toISOString() ?? null}
        standalone={true}
      />
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}
