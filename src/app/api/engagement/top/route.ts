import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/server/auth'
import { getSessionUser, can } from '@/lib/rbac'
import {
  engagementWhere,
  getEngagementExtras,
  resolveRange,
  type EngagementScope,
} from '@/server/engagementAnalytics'
import type { EngagementTopRes } from '@/lib/api-contracts'

/**
 * The legacy admin cookie is only ever issued to practice admins and
 * superusers, but getSession()'s NextAuth fallback also maps STANDARD users
 * with a default surgery into a 'surgery'-shaped session. This data includes
 * per-user activity, so NextAuth-derived surgery sessions must additionally
 * hold an ADMIN membership for the surgery.
 */
async function isSurgeryAdminSession(surgeryId: string): Promise<boolean> {
  const cookieStore = await cookies()
  if (cookieStore.get('session')?.value) return true
  const user = await getSessionUser()
  return !!user && can(user).manageSurgery(surgeryId)
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BooleanFlagZ = z
  .enum(['true', 'false'])
  .optional()
  .transform(v => v === 'true')

const QueryZ = z.object({
  surgeryId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).catch(10),
  // Named ranges rather than a caller-supplied startDate: the window is
  // resolved server-side onto whole Europe/London days so it doesn't shift
  // with the caller's clock.
  range: z.enum(['7d', '30d', '90d', 'all']).catch('30d'),
  includeSurgeryBreakdown: BooleanFlagZ,
  includeTestSurgeries: BooleanFlagZ,
})

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = QueryZ.safeParse({
      surgeryId: searchParams.get('surgeryId') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      range: searchParams.get('range') ?? undefined,
      includeSurgeryBreakdown: searchParams.get('includeSurgeryBreakdown') ?? undefined,
      includeTestSurgeries: searchParams.get('includeTestSurgeries') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
    }
    const { limit, range } = parsed.data

    // Scope enforcement: surgery admins only ever see their own surgery;
    // the all-surgeries overview and per-surgery breakdown are superuser-only.
    let surgeryId: string | null
    let includeSurgeryBreakdown: boolean
    let includeTestSurgeries: boolean
    if (session.type === 'surgery') {
      if (!session.surgeryId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (parsed.data.surgeryId && parsed.data.surgeryId !== session.surgeryId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (!(await isSurgeryAdminSession(session.surgeryId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      surgeryId = session.surgeryId
      includeSurgeryBreakdown = false
      // Irrelevant for a single pinned surgery, which is always reported on.
      includeTestSurgeries = false
    } else {
      surgeryId = parsed.data.surgeryId ?? null
      includeSurgeryBreakdown = parsed.data.includeSurgeryBreakdown
      includeTestSurgeries = parsed.data.includeTestSurgeries
    }

    // One instant for the whole request: the window and the trend's final
    // bucket must not straddle a midnight between two Date() calls.
    const now = new Date()
    const { start, previousWindow } = resolveRange(range, now)
    const scope: EngagementScope = {
      surgeryId,
      startDate: start,
      previousWindow,
      includeTestSurgeries,
    }
    const where = engagementWhere(scope)

    // Top users by engagement count. The symptom leaderboard is built from the
    // tracked library in getEngagementExtras so it shares one ranking with the
    // "symptoms accessed" tile and the least-viewed card.
    const [topUsers, extras, surgeryBreakdown] = await Promise.all([
      prisma.engagementEvent.groupBy({
        by: ['userEmail'],
        where: { ...where, userEmail: { not: null } },
        _count: { userEmail: true },
        orderBy: { _count: { userEmail: 'desc' } },
        take: limit,
      }),
      getEngagementExtras(scope, now, { topTake: limit }),
      includeSurgeryBreakdown ? getSurgeryBreakdown(where) : Promise.resolve(undefined),
    ])

    const response: EngagementTopRes = {
      topUsers: topUsers.map(item => ({
        userEmail: item.userEmail as string,
        engagementCount: item._count.userEmail,
      })),
      surgeryBreakdown,
      ...extras,
    }
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching engagement data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch engagement data' },
      { status: 500 }
    )
  }
}

async function getSurgeryBreakdown(where: object) {
  // Get engagement events grouped by surgery
  const surgeryEngagement = await prisma.engagementEvent.groupBy({
    by: ['surgeryId'],
    where,
    _count: {
      surgeryId: true,
    },
    orderBy: {
      _count: {
        surgeryId: 'desc',
      },
    },
  })

  // Get surgery details
  const surgeryIds = surgeryEngagement.map(item => item.surgeryId).filter((id): id is string => id !== null)
  const surgeries = await prisma.surgery.findMany({
    where: { id: { in: surgeryIds } },
    select: {
      id: true,
      name: true,
      slug: true,
    }
  })

  // Combine with counts
  return surgeryEngagement.flatMap(item => {
    if (!item.surgeryId) return []
    const surgery = surgeries.find(s => s.id === item.surgeryId)
    return [{
      surgeryId: item.surgeryId,
      surgeryName: surgery?.name || 'Unknown Surgery',
      surgerySlug: surgery?.slug ?? null,
      engagementCount: item._count.surgeryId,
    }]
  })
}
