/**
 * API route for recently changed Practice Handbook items.
 * Respects RBAC: only returns items the user is allowed to view.
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import {
  getRecentlyChangedHandbookItems,
  getRecentlyChangedHandbookItemsCount,
  DEFAULT_CHANGE_WINDOW_DAYS,
} from '@/server/recentlyChangedHandbookItems'
import {
  readChangesBaselineDate,
  isBaselineActive,
  formatBaselineDate,
} from '@/server/whatsChangedBaseline'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z.object({
  surgeryId: z.string().min(1),
  windowDays: z.coerce.number().int().min(1).max(365).optional(),
  countOnly: z.enum(['true', 'false']).optional(),
})

/**
 * Resolves a surgery identifier (ID or slug) to the actual database ID and uiConfig.
 */
async function resolveSurgery(identifier: string): Promise<{ id: string; uiConfig: unknown } | null> {
  // Try by ID first
  const byId = await prisma.surgery.findUnique({
    where: { id: identifier },
    select: { id: true, uiConfig: true },
  })
  if (byId) return byId

  // Try by slug
  const bySlug = await prisma.surgery.findUnique({
    where: { slug: identifier },
    select: { id: true, uiConfig: true },
  })
  return bySlug ?? null
}

/**
 * GET /api/admin-toolkit/changes
 *
 * Query parameters:
 * - surgeryId (required): The surgery to scope the query to (accepts ID or slug)
 * - windowDays (optional): Number of days to look back (default: 14, max: 365)
 * - countOnly (optional): If 'true', returns only the count
 *
 * Returns:
 * - If countOnly=true: { count: number }
 * - Otherwise: { changes: RecentlyChangedHandbookItem[], count: number }
 *
 * RBAC: Only items in categories the user can view are included.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    // Convert null to undefined so Zod's .optional() handles missing params correctly
    const params = {
      surgeryId: url.searchParams.get('surgeryId') ?? undefined,
      windowDays: url.searchParams.get('windowDays') ?? undefined,
      countOnly: url.searchParams.get('countOnly') ?? undefined,
    }

    const parsed = querySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { surgeryId: surgeryIdentifier, windowDays = DEFAULT_CHANGE_WINDOW_DAYS, countOnly } = parsed.data

    // Resolve surgery ID or slug to actual database ID
    const surgery = await resolveSurgery(surgeryIdentifier)
    if (!surgery) {
      return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
    }
    const surgeryId = surgery.id

    // Verify user has access to this surgery
    const membership = user.memberships.find((m) => m.surgeryId === surgeryId)
    const isSuperuser = user.globalRole === 'SUPERUSER'
    if (!membership && !isSuperuser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get baseline date for this surgery
    const baselineDate = readChangesBaselineDate(surgery.uiConfig, 'practiceHandbook')
    const baselineIsActive = isBaselineActive(windowDays, baselineDate)
    const baselineDateFormatted = baselineDate ? formatBaselineDate(baselineDate) : null

    // If countOnly requested, return just the count
    if (countOnly === 'true') {
      const count = await getRecentlyChangedHandbookItemsCount(user, surgeryId, windowDays, baselineDate)
      return NextResponse.json({ count, baselineDate: baselineDateFormatted, baselineIsActive })
    }

    // Return full list of recently changed items
    const changes = await getRecentlyChangedHandbookItems(user, surgeryId, windowDays, baselineDate)
    const count = changes.length

    // Serialize dates to ISO strings
    const serialisedChanges = changes.map((change) => ({
      ...change,
      changedAt: change.changedAt.toISOString(),
    }))

    return NextResponse.json({
      changes: serialisedChanges,
      count,
      baselineDate: baselineDateFormatted,
      baselineIsActive,
    })
  } catch (error) {
    console.error('Error fetching recently changed handbook items:', error)
    return NextResponse.json({ error: 'Failed to fetch recently changed items' }, { status: 500 })
  }
}
