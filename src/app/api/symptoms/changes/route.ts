/**
 * API route for recently changed (approved) symptoms.
 * Only returns approved, live content - never exposes drafts, pending, or internal metadata.
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAccess } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { 
  getRecentlyChangedSymptoms, 
  getRecentlyChangedSymptomsCount,
  batchCheckSymptomsRecentlyChanged,
  DEFAULT_CHANGE_WINDOW_DAYS
} from '@/server/recentlyChangedSymptoms'
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
  symptomIds: z.string().optional() // Comma-separated list for batch check
})

/**
 * Resolves a surgery identifier (ID or slug) to the actual database ID and uiConfig.
 */
async function resolveSurgery(identifier: string): Promise<{ id: string; uiConfig: unknown } | null> {
  // Try by ID first
  const byId = await prisma.surgery.findUnique({
    where: { id: identifier },
    select: { id: true, uiConfig: true }
  })
  if (byId) return byId

  // Try by slug
  const bySlug = await prisma.surgery.findUnique({
    where: { slug: identifier },
    select: { id: true, uiConfig: true }
  })
  return bySlug ?? null
}

/**
 * GET /api/symptoms/changes
 * 
 * Query parameters:
 * - surgeryId (required): The surgery to scope the query to (accepts ID or slug)
 * - windowDays (optional): Number of days to look back (default: 14, max: 365)
 * - countOnly (optional): If 'true', returns only the count
 * - symptomIds (optional): Comma-separated list of symptom IDs for batch check
 * 
 * Returns:
 * - If countOnly=true: { count: number }
 * - If symptomIds provided: { changes: { [symptomId]: { changeType, approvedAt } } }
 * - Otherwise: { changes: RecentlyChangedSymptom[], count: number }
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    // Convert null to undefined so Zod's .optional() handles missing params correctly
    const params = {
      surgeryId: url.searchParams.get('surgeryId') ?? undefined,
      windowDays: url.searchParams.get('windowDays') ?? undefined,
      countOnly: url.searchParams.get('countOnly') ?? undefined,
      symptomIds: url.searchParams.get('symptomIds') ?? undefined
    }

    const parsed = querySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { surgeryId: surgeryIdentifier, windowDays = DEFAULT_CHANGE_WINDOW_DAYS, countOnly, symptomIds } = parsed.data

    // Resolve surgery ID or slug to actual database ID
    const surgery = await resolveSurgery(surgeryIdentifier)
    if (!surgery) {
      return NextResponse.json(
        { error: 'Surgery not found' },
        { status: 404 }
      )
    }
    const surgeryId = surgery.id

    // Verify user has access to this surgery
    await requireSurgeryAccess(surgeryId)

    // Get baseline date for this surgery
    const baselineDate = readChangesBaselineDate(surgery.uiConfig, 'signposting')
    const baselineIsActive = isBaselineActive(windowDays, baselineDate)
    const baselineDateFormatted = baselineDate ? formatBaselineDate(baselineDate) : null

    // If countOnly requested, return just the count
    if (countOnly === 'true') {
      const count = await getRecentlyChangedSymptomsCount(surgeryId, windowDays, baselineDate)
      return NextResponse.json({ count, baselineDate: baselineDateFormatted, baselineIsActive })
    }

    // If symptomIds provided, return batch check results
    if (symptomIds) {
      const ids = symptomIds.split(',').map(id => id.trim()).filter(Boolean)
      if (ids.length === 0) {
        return NextResponse.json({ changes: {} })
      }

      const changesMap = await batchCheckSymptomsRecentlyChanged(surgeryId, ids, windowDays, baselineDate)
      
      // Convert Map to plain object for JSON serialization
      const changes: Record<string, { changeType: 'new' | 'updated'; approvedAt: string }> = {}
      for (const [id, info] of changesMap) {
        changes[id] = {
          changeType: info.changeType,
          approvedAt: info.approvedAt.toISOString()
        }
      }
      
      return NextResponse.json({ changes })
    }

    // Return full list of recently changed symptoms
    const changes = await getRecentlyChangedSymptoms(surgeryId, windowDays, baselineDate)
    const count = changes.length

    // Serialize dates to ISO strings
    const serialisedChanges = changes.map(change => ({
      ...change,
      approvedAt: change.approvedAt.toISOString()
    }))

    return NextResponse.json({
      changes: serialisedChanges,
      count,
      baselineDate: baselineDateFormatted,
      baselineIsActive,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('Error fetching recently changed symptoms:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recently changed symptoms' },
      { status: 500 }
    )
  }
}
