import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { computeClinicalReviewCounts, getClinicalReviewKey } from '@/lib/clinicalReviewCounts'

export const runtime = 'nodejs'

// GET /api/admin/surgery-health?surgeryId=xxx
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

    await requireSurgeryAdmin(surgeryId)

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Get review counts using the shared utility
    const allSymptoms = await getEffectiveSymptoms(surgeryId, true)
    const allReviewStatuses = await prisma.symptomReviewStatus.findMany({
      where: { surgeryId },
      select: { symptomId: true, ageGroup: true, status: true },
    })
    const statusMap = new Map(
      allReviewStatuses.map(rs => [getClinicalReviewKey(rs.symptomId, rs.ageGroup), rs])
    )
    const reviewCounts = computeClinicalReviewCounts(allSymptoms, statusMap as any)

    const [
      activeUserGroups,
      totalViewsLast30,
      topSymptomRaw,
      lastReviewActivity,
      recentlyUpdatedCount,
    ] = await Promise.all([
      prisma.engagementEvent.groupBy({
        by: ['userEmail'],
        where: { surgeryId, createdAt: { gte: thirtyDaysAgo }, userEmail: { not: null } }
      }).then(r => r.length).catch(() => 0),
      prisma.engagementEvent.count({
        where: { surgeryId, createdAt: { gte: thirtyDaysAgo }, event: 'view_symptom' }
      }).catch(() => 0),
      prisma.engagementEvent.groupBy({
        by: ['baseId'],
        where: { surgeryId, createdAt: { gte: thirtyDaysAgo }, event: 'view_symptom' },
        _count: { baseId: true },
        orderBy: { _count: { baseId: 'desc' } },
        take: 1
      }).catch(() => [] as Array<{ baseId: string; _count: { baseId: number } }>),
      prisma.symptomReviewStatus.findFirst({
        where: { surgeryId, lastReviewedAt: { not: null } },
        orderBy: { lastReviewedAt: 'desc' },
        select: { lastReviewedAt: true }
      }).catch(() => null),
      prisma.symptomReviewStatus.count({
        where: { surgeryId, lastReviewedAt: { gte: thirtyDaysAgo } }
      }).catch(() => 0),
    ])

    return NextResponse.json({
      pendingReviewCount: reviewCounts.pending,
      changesRequestedCount: reviewCounts.changesRequested,
      lastReviewActivity: lastReviewActivity?.lastReviewedAt ?? null,
      activeUsersLast30: activeUserGroups,
      totalViewsLast30,
      topSymptomId: (topSymptomRaw as Array<{ baseId: string; _count: { baseId: number } }>)[0]?.baseId ?? null,
      topSymptomCount: (topSymptomRaw as Array<{ baseId: string; _count: { baseId: number } }>)[0]?._count?.baseId ?? 0,
      approvedCount: reviewCounts.approved,
      recentlyUpdatedCount,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching surgery health data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch surgery health data' },
      { status: 500 }
    )
  }
}
