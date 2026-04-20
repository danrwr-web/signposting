import 'server-only'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { computeClinicalReviewCounts, getClinicalReviewKey } from '@/lib/clinicalReviewCounts'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import type { AppointmentModelConfig } from '@/lib/api-contracts'

export const HEALTH_WINDOW_DAYS = 30

const FEATURE_KEYS = ['ai_surgery_customisation', 'admin_toolkit'] as const

export type ChecklistData = {
  onboardingCompleted: boolean
  appointmentModelConfigured: boolean
  aiCustomisationRun: boolean | null
  pendingReviewCount: number
  standardUsersCount: number
  highRiskConfigured: boolean
  highlightsEnabled: boolean
  appointmentTypeCount: number
  handbookItemCount: number
}

export type HealthData = {
  pendingReviewCount: number
  changesRequestedCount: number
  lastReviewActivity: string | null
  activeUsersLast30: number
  totalViewsLast30: number
  topSymptomId: string | null
  topSymptomCount: number
  approvedCount: number
  recentlyUpdatedCount: number
}

export type SurgeryStage = 'not_started' | 'in_progress' | 'nearly_there' | 'live'

export type SurgerySetupSnapshot = {
  surgeryId: string
  surgeryName: string
  createdAt: Date
  requiresClinicalReview: boolean
  onboardingCompleted: boolean
  onboardingCompletedAt: Date | null
  onboardingUpdatedAt: Date | null
  onboardingStarted: boolean
  appointmentModelConfigured: boolean
  aiCustomisationOccurred: boolean | null
  pendingCount: number
  checklist: ChecklistData
  health: HealthData
  features: string[]
  stage: SurgeryStage
  essentialCount: number
  essentialTotal: number
  recommendedCount: number
  recommendedTotal: number
  lastActivityAt: Date | null
  goLiveDate: Date | null
}

function isAppointmentModelConfigured(profileJson: unknown): boolean {
  const json = profileJson as { appointmentModel?: AppointmentModelConfig } | null
  const am = json?.appointmentModel
  if (!am) return false
  const gpEnabled = [
    am.routineContinuityGp,
    am.routineGpPhone,
    am.gpTriage48h,
    am.urgentSameDayPhone,
    am.urgentSameDayF2F,
    am.otherClinicianDirect,
  ].some(arch => arch?.enabled === true)
  const clinicianEnabled = (am.clinicianArchetypes || []).some(ca => ca.enabled === true)
  return gpEnabled || clinicianEnabled
}

function computeStage(
  essentialComplete: boolean,
  recommendedComplete: boolean,
  onboardingStarted: boolean,
  activeUsersLast30: number,
): SurgeryStage {
  if (!onboardingStarted && !essentialComplete) return 'not_started'
  if (!essentialComplete) return 'in_progress'
  if (essentialComplete && recommendedComplete && activeUsersLast30 >= 1) return 'live'
  if (essentialComplete && recommendedComplete) return 'live'
  return 'nearly_there'
}

function computeEssentialRecommended(
  checklist: ChecklistData,
  features: string[],
): { essentialCount: number; essentialTotal: number; recommendedCount: number; recommendedTotal: number } {
  const aiEnabled = features.includes('ai_surgery_customisation')
  const handbookEnabled = features.includes('admin_toolkit')
  const essentialItems = [
    checklist.onboardingCompleted,
    checklist.appointmentModelConfigured,
    checklist.standardUsersCount > 0,
    checklist.highRiskConfigured,
    aiEnabled ? checklist.aiCustomisationRun === true : true,
    checklist.pendingReviewCount < 10,
  ]
  const recommendedItems = [
    checklist.appointmentTypeCount > 0,
    checklist.highlightsEnabled,
    handbookEnabled ? checklist.handbookItemCount > 0 : true,
  ]
  return {
    essentialCount: essentialItems.filter(Boolean).length,
    essentialTotal: essentialItems.length,
    recommendedCount: recommendedItems.filter(Boolean).length,
    recommendedTotal: recommendedItems.length,
  }
}

/**
 * Full-fidelity per-surgery snapshot. Used by the per-surgery route and by
 * the superuser tracker's detail drawer (when `lightweight=false`).
 */
export async function computeSurgerySetupSnapshot(surgeryId: string): Promise<SurgerySetupSnapshot | null> {
  const surgery = await prisma.surgery.findUnique({
    where: { id: surgeryId },
    include: {
      onboardingProfile: {
        select: { completed: true, completedAt: true, updatedAt: true, profileJson: true },
      },
      pipelineEntry: { select: { dateContractStart: true } },
    },
  })
  if (!surgery) return null

  const onboardingCompleted = surgery.onboardingProfile?.completed ?? false
  const onboardingCompletedAt = surgery.onboardingProfile?.completedAt ?? null
  const onboardingUpdatedAt = surgery.onboardingProfile?.updatedAt ?? null
  const profileJson = surgery.onboardingProfile?.profileJson ?? null
  const appointmentModelConfigured = isAppointmentModelConfigured(profileJson)
  const profileSurgeryName = (profileJson as { surgeryName?: string } | null)?.surgeryName
  const onboardingStarted = !!(surgery.onboardingProfile && (profileSurgeryName || appointmentModelConfigured))

  // Exact pending-review count (uses effective symptoms + status map).
  const allSymptoms = await getEffectiveSymptoms(surgeryId, true)
  const allReviewStatuses = await prisma.symptomReviewStatus.findMany({
    where: { surgeryId },
    select: { symptomId: true, ageGroup: true, status: true },
  })
  const statusMap = new Map(
    allReviewStatuses.map(rs => [getClinicalReviewKey(rs.symptomId, rs.ageGroup), rs]),
  )
  const reviewCounts = computeClinicalReviewCounts(allSymptoms, statusMap as never)

  // AI customisation evidence: any history row with a non-REVERT model on an
  // override or custom symptom belonging to this surgery.
  const [overrides, customs] = await Promise.all([
    prisma.surgerySymptomOverride.findMany({ where: { surgeryId }, select: { baseSymptomId: true } }),
    prisma.surgeryCustomSymptom.findMany({ where: { surgeryId, isDeleted: false }, select: { id: true } }),
  ])
  const allCustomisableIds = [...overrides.map(o => o.baseSymptomId), ...customs.map(c => c.id)]
  let aiCustomisationOccurred = false
  if (allCustomisableIds.length > 0) {
    const aiRow = await prisma.symptomHistory.findFirst({
      where: {
        symptomId: { in: allCustomisableIds },
        modelUsed: { not: null },
        NOT: { modelUsed: 'REVERT' },
      },
      select: { id: true },
    })
    aiCustomisationOccurred = aiRow !== null
  }

  const thirtyDaysAgo = new Date(Date.now() - HEALTH_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const [
    standardUsersCount,
    highRiskLinksCount,
    defaultHighRiskEnabledCount,
    customHighlightCount,
    appointmentTypeCount,
    handbookItemCount,
    activeUserGroups,
    totalViewsLast30,
    topSymptomRaw,
    lastReviewActivity,
    recentlyUpdatedCount,
    lastEngagement,
    aiEnabled,
    handbookEnabled,
  ] = await Promise.all([
    prisma.userSurgery.count({ where: { surgeryId, role: { not: 'ADMIN' } } }),
    prisma.highRiskLink.count({ where: { surgeryId } }),
    prisma.defaultHighRiskButtonConfig.count({ where: { surgeryId, isEnabled: true } }),
    prisma.highlightRule.count({ where: { surgeryId } }),
    prisma.appointmentType.count({ where: { surgeryId } }),
    prisma.adminItem.count({ where: { surgeryId, deletedAt: null } }),
    prisma.engagementEvent
      .groupBy({
        by: ['userEmail'],
        where: { surgeryId, createdAt: { gte: thirtyDaysAgo }, userEmail: { not: null } },
      })
      .then(r => r.length)
      .catch(() => 0),
    prisma.engagementEvent
      .count({ where: { surgeryId, createdAt: { gte: thirtyDaysAgo }, event: 'view_symptom' } })
      .catch(() => 0),
    prisma.engagementEvent
      .groupBy({
        by: ['baseId'],
        where: { surgeryId, createdAt: { gte: thirtyDaysAgo }, event: 'view_symptom' },
        _count: { baseId: true },
        orderBy: { _count: { baseId: 'desc' } },
        take: 1,
      })
      .catch(() => [] as Array<{ baseId: string; _count: { baseId: number } }>),
    prisma.symptomReviewStatus
      .findFirst({
        where: { surgeryId, lastReviewedAt: { not: null } },
        orderBy: { lastReviewedAt: 'desc' },
        select: { lastReviewedAt: true },
      })
      .catch(() => null),
    prisma.symptomReviewStatus
      .count({ where: { surgeryId, lastReviewedAt: { gte: thirtyDaysAgo } } })
      .catch(() => 0),
    prisma.engagementEvent
      .findFirst({ where: { surgeryId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
      .catch(() => null),
    isFeatureEnabledForSurgery(surgeryId, 'ai_surgery_customisation'),
    isFeatureEnabledForSurgery(surgeryId, 'admin_toolkit'),
  ])

  const highRiskConfigured = highRiskLinksCount > 0 || defaultHighRiskEnabledCount > 0 || surgery.enableDefaultHighRisk
  const highlightsEnabled = surgery.enableBuiltInHighlights || customHighlightCount > 0

  const features: string[] = []
  if (aiEnabled) features.push('ai_surgery_customisation')
  if (handbookEnabled) features.push('admin_toolkit')

  const checklist: ChecklistData = {
    onboardingCompleted,
    appointmentModelConfigured,
    aiCustomisationRun: aiCustomisationOccurred,
    pendingReviewCount: reviewCounts.pending,
    standardUsersCount,
    highRiskConfigured,
    highlightsEnabled,
    appointmentTypeCount,
    handbookItemCount,
  }

  const health: HealthData = {
    pendingReviewCount: reviewCounts.pending,
    changesRequestedCount: reviewCounts.changesRequested,
    lastReviewActivity: lastReviewActivity?.lastReviewedAt?.toISOString() ?? null,
    activeUsersLast30: activeUserGroups as number,
    totalViewsLast30: totalViewsLast30 as number,
    topSymptomId: (topSymptomRaw as Array<{ baseId: string }>)[0]?.baseId ?? null,
    topSymptomCount: (topSymptomRaw as Array<{ _count: { baseId: number } }>)[0]?._count?.baseId ?? 0,
    approvedCount: reviewCounts.approved,
    recentlyUpdatedCount: recentlyUpdatedCount as number,
  }

  const { essentialCount, essentialTotal, recommendedCount, recommendedTotal } =
    computeEssentialRecommended(checklist, features)
  const essentialComplete = essentialCount === essentialTotal
  const recommendedComplete = recommendedCount === recommendedTotal
  const stage = computeStage(essentialComplete, recommendedComplete, onboardingStarted, health.activeUsersLast30)

  return {
    surgeryId,
    surgeryName: surgery.name,
    createdAt: surgery.createdAt,
    requiresClinicalReview: surgery.requiresClinicalReview,
    onboardingCompleted,
    onboardingCompletedAt,
    onboardingUpdatedAt,
    onboardingStarted,
    appointmentModelConfigured,
    aiCustomisationOccurred,
    pendingCount: reviewCounts.pending,
    checklist,
    health,
    features,
    stage,
    essentialCount,
    essentialTotal,
    recommendedCount,
    recommendedTotal,
    lastActivityAt: lastEngagement?.createdAt ?? null,
    goLiveDate: surgery.pipelineEntry?.dateContractStart ?? null,
  }
}

type SurgeryRowForBatch = {
  id: string
  name: string
  createdAt: Date
  requiresClinicalReview: boolean
  enableDefaultHighRisk: boolean
  enableBuiltInHighlights: boolean
  onboardingProfile: {
    completed: boolean
    completedAt: Date | null
    updatedAt: Date
    profileJson: unknown
  } | null
  pipelineEntry: { dateContractStart: Date | null } | null
}

/**
 * Lightweight batch snapshot. Used for the superuser tracker list view.
 *
 * Differences from the full snapshot:
 * - `pendingReviewCount` is a count of `SymptomReviewStatus` rows with
 *   status='PENDING' for the surgery. This is cheap but diverges from the
 *   exact effective-symptoms-merge logic (which counts symptoms without any
 *   status row as pending). Good enough for flagging.
 * - `aiCustomisationRun` is returned as `null` and must be resolved on demand
 *   by the detail drawer calling `computeSurgerySetupSnapshot`.
 * - `topSymptomId` / `topSymptomCount` are always `null` / `0`.
 */
export async function computeSurgerySetupSnapshotsBatch(
  surgeryIds?: string[],
): Promise<SurgerySetupSnapshot[]> {
  const whereClause = surgeryIds && surgeryIds.length > 0 ? { id: { in: surgeryIds } } : {}
  const surgeries = (await prisma.surgery.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      createdAt: true,
      requiresClinicalReview: true,
      enableDefaultHighRisk: true,
      enableBuiltInHighlights: true,
      onboardingProfile: {
        select: { completed: true, completedAt: true, updatedAt: true, profileJson: true },
      },
      pipelineEntry: { select: { dateContractStart: true } },
    },
    orderBy: { createdAt: 'desc' },
  })) as SurgeryRowForBatch[]

  if (surgeries.length === 0) return []
  const ids = surgeries.map(s => s.id)
  const thirtyDaysAgo = new Date(Date.now() - HEALTH_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const [
    standardUserCounts,
    highRiskLinkCounts,
    defaultHighRiskCounts,
    highlightRuleCounts,
    appointmentTypeCounts,
    handbookItemCounts,
    pendingReviewCounts,
    changesRequestedCounts,
    approvedCounts,
    recentReviewCounts,
    lastReviewActivityRows,
    viewCounts,
    lastEngagementRows,
    activeUserEvents,
    perSurgeryFeatures,
  ] = await Promise.all([
    prisma.userSurgery.groupBy({
      by: ['surgeryId'],
      where: { surgeryId: { in: ids }, role: { not: 'ADMIN' } },
      _count: { _all: true },
    }),
    prisma.highRiskLink.groupBy({
      by: ['surgeryId'],
      where: { surgeryId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.defaultHighRiskButtonConfig.groupBy({
      by: ['surgeryId'],
      where: { surgeryId: { in: ids }, isEnabled: true },
      _count: { _all: true },
    }),
    prisma.highlightRule.groupBy({
      by: ['surgeryId'],
      where: { surgeryId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.appointmentType.groupBy({
      by: ['surgeryId'],
      where: { surgeryId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.adminItem.groupBy({
      by: ['surgeryId'],
      where: { surgeryId: { in: ids }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.symptomReviewStatus.groupBy({
      by: ['surgeryId'],
      where: { surgeryId: { in: ids }, status: 'PENDING' },
      _count: { _all: true },
    }),
    prisma.symptomReviewStatus.groupBy({
      by: ['surgeryId'],
      where: { surgeryId: { in: ids }, status: 'CHANGES_REQUIRED' },
      _count: { _all: true },
    }),
    prisma.symptomReviewStatus.groupBy({
      by: ['surgeryId'],
      where: { surgeryId: { in: ids }, status: 'APPROVED' },
      _count: { _all: true },
    }),
    prisma.symptomReviewStatus.groupBy({
      by: ['surgeryId'],
      where: { surgeryId: { in: ids }, lastReviewedAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
    prisma.symptomReviewStatus.groupBy({
      by: ['surgeryId'],
      where: { surgeryId: { in: ids }, lastReviewedAt: { not: null } },
      _max: { lastReviewedAt: true },
    }),
    prisma.engagementEvent.groupBy({
      by: ['surgeryId'],
      where: { surgeryId: { in: ids }, createdAt: { gte: thirtyDaysAgo }, event: 'view_symptom' },
      _count: { _all: true },
    }),
    prisma.engagementEvent.groupBy({
      by: ['surgeryId'],
      where: { surgeryId: { in: ids } },
      _max: { createdAt: true },
    }),
    prisma.engagementEvent.findMany({
      where: { surgeryId: { in: ids }, createdAt: { gte: thirtyDaysAgo }, userEmail: { not: null } },
      select: { surgeryId: true, userEmail: true },
      distinct: ['surgeryId', 'userEmail'],
    }),
    prisma.surgeryFeatureFlag.findMany({
      where: {
        surgeryId: { in: ids },
        enabled: true,
        feature: { key: { in: [...FEATURE_KEYS] } },
      },
      select: { surgeryId: true, feature: { select: { key: true } } },
    }),
  ])

  const byId = <T extends { surgeryId: string | null }>(rows: T[]): Map<string, T> => {
    const m = new Map<string, T>()
    for (const r of rows) if (r.surgeryId) m.set(r.surgeryId, r)
    return m
  }
  const countById = <T extends { surgeryId: string | null; _count: { _all: number } }>(rows: T[]) => {
    const m = new Map<string, number>()
    for (const r of rows) if (r.surgeryId) m.set(r.surgeryId, r._count._all)
    return m
  }
  const standardUserMap = countById(standardUserCounts)
  const highRiskLinkMap = countById(highRiskLinkCounts)
  const defaultHighRiskMap = countById(defaultHighRiskCounts)
  const highlightRuleMap = countById(highlightRuleCounts)
  const appointmentTypeMap = countById(appointmentTypeCounts)
  const handbookItemMap = countById(handbookItemCounts)
  const pendingMap = countById(pendingReviewCounts)
  const changesMap = countById(changesRequestedCounts)
  const approvedMap = countById(approvedCounts)
  const recentReviewMap = countById(recentReviewCounts)
  const viewCountMap = countById(viewCounts)
  const lastReviewMap = byId(lastReviewActivityRows)
  const lastEngagementMap = byId(lastEngagementRows)

  const activeUsersMap = new Map<string, number>()
  for (const row of activeUserEvents) {
    if (!row.surgeryId) continue
    activeUsersMap.set(row.surgeryId, (activeUsersMap.get(row.surgeryId) || 0) + 1)
  }

  const featuresMap = new Map<string, string[]>()
  for (const row of perSurgeryFeatures) {
    const list = featuresMap.get(row.surgeryId) || []
    list.push(row.feature.key)
    featuresMap.set(row.surgeryId, list)
  }

  return surgeries.map(s => {
    const onboardingCompleted = s.onboardingProfile?.completed ?? false
    const onboardingCompletedAt = s.onboardingProfile?.completedAt ?? null
    const onboardingUpdatedAt = s.onboardingProfile?.updatedAt ?? null
    const profileJson = s.onboardingProfile?.profileJson ?? null
    const appointmentModelConfigured = isAppointmentModelConfigured(profileJson)
    const profileSurgeryName = (profileJson as { surgeryName?: string } | null)?.surgeryName
    const onboardingStarted = !!(s.onboardingProfile && (profileSurgeryName || appointmentModelConfigured))

    const standardUsersCount = standardUserMap.get(s.id) || 0
    const highRiskLinksCount = highRiskLinkMap.get(s.id) || 0
    const defaultHighRiskEnabledCount = defaultHighRiskMap.get(s.id) || 0
    const customHighlightCount = highlightRuleMap.get(s.id) || 0
    const appointmentTypeCount = appointmentTypeMap.get(s.id) || 0
    const handbookItemCount = handbookItemMap.get(s.id) || 0
    const pendingReviewCount = pendingMap.get(s.id) || 0
    const changesRequestedCount = changesMap.get(s.id) || 0
    const approvedCount = approvedMap.get(s.id) || 0
    const recentlyUpdatedCount = recentReviewMap.get(s.id) || 0
    const totalViewsLast30 = viewCountMap.get(s.id) || 0
    const activeUsersLast30 = activeUsersMap.get(s.id) || 0
    const features = featuresMap.get(s.id) || []

    const highRiskConfigured =
      highRiskLinksCount > 0 || defaultHighRiskEnabledCount > 0 || s.enableDefaultHighRisk
    const highlightsEnabled = s.enableBuiltInHighlights || customHighlightCount > 0

    const checklist: ChecklistData = {
      onboardingCompleted,
      appointmentModelConfigured,
      // Unknown in lightweight mode — rule engine treats null as "don't flag".
      aiCustomisationRun: null,
      pendingReviewCount,
      standardUsersCount,
      highRiskConfigured,
      highlightsEnabled,
      appointmentTypeCount,
      handbookItemCount,
    }

    const health: HealthData = {
      pendingReviewCount,
      changesRequestedCount,
      lastReviewActivity: lastReviewMap.get(s.id)?._max.lastReviewedAt?.toISOString() ?? null,
      activeUsersLast30,
      totalViewsLast30,
      topSymptomId: null,
      topSymptomCount: 0,
      approvedCount,
      recentlyUpdatedCount,
    }

    const { essentialCount, essentialTotal, recommendedCount, recommendedTotal } =
      computeEssentialRecommended(checklist, features)
    const essentialComplete = essentialCount === essentialTotal
    const recommendedComplete = recommendedCount === recommendedTotal
    const stage = computeStage(essentialComplete, recommendedComplete, onboardingStarted, activeUsersLast30)

    return {
      surgeryId: s.id,
      surgeryName: s.name,
      createdAt: s.createdAt,
      requiresClinicalReview: s.requiresClinicalReview,
      onboardingCompleted,
      onboardingCompletedAt,
      onboardingUpdatedAt,
      onboardingStarted,
      appointmentModelConfigured,
      aiCustomisationOccurred: null,
      pendingCount: pendingReviewCount,
      checklist,
      health,
      features,
      stage,
      essentialCount,
      essentialTotal,
      recommendedCount,
      recommendedTotal,
      lastActivityAt: lastEngagementMap.get(s.id)?._max.createdAt ?? null,
      goLiveDate: s.pipelineEntry?.dateContractStart ?? null,
    }
  })
}
