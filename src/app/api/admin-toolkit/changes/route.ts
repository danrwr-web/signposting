/**
 * API route for recently changed Practice Handbook items.
 * Respects RBAC: only returns items the user is allowed to view.
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
  getRecentlyChangedHandbookItems,
  getRecentlyChangedHandbookItemsCount,
  DEFAULT_CHANGE_WINDOW_DAYS,
} from '@/server/recentlyChangedHandbookItems'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z.object({
  surgeryId: z.string().min(1),
  windowDays: z.coerce.number().int().min(1).max(365).optional(),
  countOnly: z.enum(['true', 'false']).optional(),
})

/**
 * Resolves a surgery identifier (ID or slug) to the actual database ID.
 */
async function resolveSurgeryId(identifier: string): Promise<string | null> {
  // Try by ID first
  const byId = await prisma.surgery.findUnique({
    where: { id: identifier },
    select: { id: true },
  })
  if (byId) return byId.id

  // Try by slug
  const bySlug = await prisma.surgery.findUnique({
    where: { slug: identifier },
    select: { id: true },
  })
  return bySlug?.id ?? null
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
    const session = await getSession()
    if (!session?.user) {
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
    const surgeryId = await resolveSurgeryId(surgeryIdentifier)
    if (!surgeryId) {
      return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
    }

    // Verify user has access to this surgery
    const membership = session.user.memberships.find((m) => m.surgeryId === surgeryId)
    const isSuperuser = session.user.globalRole === 'SUPERUSER'
    if (!membership && !isSuperuser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // If countOnly requested, return just the count
    if (countOnly === 'true') {
      const count = await getRecentlyChangedHandbookItemsCount(session.user, surgeryId, windowDays)
      return NextResponse.json({ count })
    }

    // Return full list of recently changed items
    const changes = await getRecentlyChangedHandbookItems(session.user, surgeryId, windowDays)
    const count = changes.length

    // Serialize dates to ISO strings
    const serialisedChanges = changes.map((change) => ({
      ...change,
      changedAt: change.changedAt.toISOString(),
    }))

    return NextResponse.json({ changes: serialisedChanges, count })
  } catch (error) {
    console.error('Error fetching recently changed handbook items:', error)
    return NextResponse.json({ error: 'Failed to fetch recently changed items' }, { status: 500 })
  }
}
