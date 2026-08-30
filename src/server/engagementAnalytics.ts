/**
 * Server-only aggregation for the admin Engagement Analytics tab.
 * All timestamps in EngagementEvent are naive UTC; day/hour bucketing is done
 * in Europe/London so figures line up with what UK practices experience.
 */

import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCachedEffectiveSymptoms } from '@/server/effectiveSymptoms'
import type {
  EngagementRankedSymptom,
  EngagementTotals,
  EngagementTrendPoint,
  EngagementTopRes,
} from '@/lib/api-contracts'

const VIEW_EVENT = 'view_symptom'

/** All-time trend requests are capped to this many most-recent days. */
export const TREND_CAP_DAYS = 90

export type EngagementRange = '7d' | '30d' | '90d' | 'all'

export const RANGE_DAYS: Record<Exclude<EngagementRange, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

export interface EngagementScope {
  /** null = all surgeries (superuser overview) */
  surgeryId: string | null
  /** Inclusive start of the reporting window; null = all time. */
  startDate: Date | null
  /** Equal-length window immediately before startDate, for the delta chips. */
  previousWindow: { start: Date; end: Date } | null
  /**
   * All-surgeries scope only: TEST and GLOBAL_DEFAULT practices are left out of
   * every figure unless this is set, so internal traffic doesn't inflate the
   * headline numbers. An explicitly selected surgery is always reported on,
   * whatever its type.
   */
  includeTestSurgeries: boolean
}

/** True when the scope should be narrowed to live practices only. */
function liveOnly(scope: EngagementScope): boolean {
  return !scope.surgeryId && !scope.includeTestSurgeries
}

/** Exported so the route's top-user query shares the scope's filtering exactly. */
export function engagementWhere(scope: EngagementScope): Prisma.EngagementEventWhereInput {
  const where: Prisma.EngagementEventWhereInput = { event: VIEW_EVENT }
  if (scope.surgeryId) where.surgeryId = scope.surgeryId
  if (scope.startDate) where.createdAt = { gte: scope.startDate }
  if (liveOnly(scope)) where.surgery = { is: { surgeryType: 'LIVE' } }
  return where
}

/** The same narrowing as engagementWhere, for the hand-written aggregate queries. */
function liveOnlySql(scope: EngagementScope) {
  return liveOnly(scope)
    ? Prisma.sql`AND EXISTS (SELECT 1 FROM "Surgery" s WHERE s."id" = e."surgeryId" AND s."surgeryType" = 'LIVE')`
    : Prisma.empty
}

/* ------------------------------------------------------------------ */
/*  Pure helpers (exported for unit tests)                             */
/* ------------------------------------------------------------------ */

const londonDayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const londonPartsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** Calendar date (YYYY-MM-DD) of an instant, in Europe/London. */
export function londonDay(instant: Date): string {
  return londonDayFormat.format(instant)
}

/** Offset of Europe/London from UTC at a given instant, in milliseconds. */
function londonOffsetMs(instant: Date): number {
  const parts = londonPartsFormat.formatToParts(instant)
  const at = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(p => p.type === type)?.value ?? 0)
  const asIfUtc = Date.UTC(
    at('year'),
    at('month') - 1,
    at('day'),
    at('hour'),
    at('minute'),
    at('second')
  )
  return asIfUtc - instant.getTime()
}

/** The UTC instant at which a London calendar day begins. */
export function londonMidnight(day: string): Date {
  const naive = Date.parse(`${day}T00:00:00Z`)
  // The first guess can land the wrong side of a DST transition; re-reading the
  // offset at that guess settles it.
  const firstPass = naive - londonOffsetMs(new Date(naive))
  return new Date(naive - londonOffsetMs(new Date(firstPass)))
}

/** Move a YYYY-MM-DD calendar day by whole days. */
export function shiftDay(day: string, delta: number): string {
  // Stepping at UTC noon keeps the walk immune to DST transitions.
  const noon = new Date(`${day}T12:00:00Z`)
  noon.setUTCDate(noon.getUTCDate() + delta)
  return noon.toISOString().slice(0, 10)
}

/**
 * Turn a named range into whole London calendar days. Bucketing the window on
 * midnight boundaries (rather than "now minus N×24h") means "Last 7 days" is
 * seven complete days rather than eight partial ones, and every viewer sees the
 * same window regardless of their own clock.
 */
export function resolveRange(
  range: EngagementRange,
  now: Date = new Date()
): { start: Date | null; previousWindow: { start: Date; end: Date } | null } {
  if (range === 'all') return { start: null, previousWindow: null }
  const days = RANGE_DAYS[range]
  const startDay = shiftDay(londonDay(now), -(days - 1))
  const start = londonMidnight(startDay)
  return {
    start,
    previousWindow: { start: londonMidnight(shiftDay(startDay, -days)), end: start },
  }
}

/**
 * Expand sparse per-day counts into a contiguous series covering every
 * London calendar day from start to end inclusive, filling gaps with 0.
 */
export function fillDaySeries(
  rows: Array<{ day: string; views: number }>,
  start: Date,
  end: Date
): EngagementTrendPoint[] {
  const counts = new Map(rows.map(r => [r.day, r.views]))
  const endDay = londonDay(end)
  const points: EngagementTrendPoint[] = []
  let day = londonDay(start)
  while (day <= endDay && points.length <= 400) {
    points.push({ date: day, views: counts.get(day) ?? 0 })
    day = shiftDay(day, 1)
  }
  return points
}

/**
 * Pivot grouped (dow, hour) rows into Monday-first weekday totals and
 * hour-of-day totals. dow follows Postgres ISODOW: 1 = Monday … 7 = Sunday.
 */
export function toWeekdayHourArrays(
  rows: Array<{ dow: number; hour: number; views: number }>
): { byWeekday: number[]; byHour: number[] } {
  const byWeekday = Array(7).fill(0)
  const byHour = Array(24).fill(0)
  for (const row of rows) {
    if (row.dow >= 1 && row.dow <= 7) byWeekday[row.dow - 1] += row.views
    if (row.hour >= 0 && row.hour <= 23) byHour[row.hour] += row.views
  }
  return { byWeekday, byHour }
}

/* ------------------------------------------------------------------ */
/*  Aggregations                                                       */
/* ------------------------------------------------------------------ */

/** Volume figures. The symptom count is derived from the tracked library
 *  instead (see getSymptomInsights) so every symptom figure reconciles. */
export type EngagementVolumeTotals = Omit<EngagementTotals, 'distinctSymptoms'>

export async function getTotals(scope: EngagementScope): Promise<EngagementVolumeTotals> {
  const where = engagementWhere(scope)
  // Views are only attributed to a user when the viewer held a NextAuth
  // session, so signed-in views are reported alongside the user count to make
  // the gap between the two visible.
  const signedInWhere: Prisma.EngagementEventWhereInput = { ...where, userEmail: { not: null } }
  const [totalViews, signedInViews, users, surgeries] = await Promise.all([
    prisma.engagementEvent.count({ where }),
    prisma.engagementEvent.count({ where: signedInWhere }),
    prisma.engagementEvent.groupBy({ by: ['userEmail'], where: signedInWhere }),
    scope.surgeryId
      ? Promise.resolve(null)
      : prisma.engagementEvent.groupBy({
          by: ['surgeryId'],
          where: { ...where, surgeryId: { not: null } },
        }),
  ])
  return {
    totalViews,
    signedInViews,
    distinctUsers: users.length,
    activeSurgeries: surgeries ? surgeries.length : null,
  }
}

export async function getPreviousTotals(
  scope: EngagementScope
): Promise<EngagementTopRes['previousTotals']> {
  if (!scope.previousWindow) return null
  const where: Prisma.EngagementEventWhereInput = {
    event: VIEW_EVENT,
    createdAt: { gte: scope.previousWindow.start, lt: scope.previousWindow.end },
  }
  if (scope.surgeryId) where.surgeryId = scope.surgeryId
  if (liveOnly(scope)) where.surgery = { is: { surgeryType: 'LIVE' } }
  const [totalViews, users] = await Promise.all([
    prisma.engagementEvent.count({ where }),
    prisma.engagementEvent.groupBy({
      by: ['userEmail'],
      where: { ...where, userEmail: { not: null } },
    }),
  ])
  return { totalViews, distinctUsers: users.length }
}

export async function getDailyTrend(
  scope: EngagementScope,
  now: Date = new Date()
): Promise<EngagementTopRes['trend']> {
  const capped = !scope.startDate
  const start =
    scope.startDate ?? londonMidnight(shiftDay(londonDay(now), -(TREND_CAP_DAYS - 1)))
  // COUNT(*) comes back as BigInt without the ::int cast, which
  // NextResponse.json cannot serialise.
  const rows = await prisma.$queryRaw<Array<{ day: string; views: number }>>(Prisma.sql`
    SELECT to_char(((e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London')::date, 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS views
    FROM "EngagementEvent" e
    WHERE e."event" = ${VIEW_EVENT}
      AND e."createdAt" >= ${start}
      ${scope.surgeryId ? Prisma.sql`AND e."surgeryId" = ${scope.surgeryId}` : Prisma.empty}
      ${liveOnlySql(scope)}
    GROUP BY 1
    ORDER BY 1
  `)
  return { bucket: 'day', capped, points: fillDaySeries(rows, start, now) }
}

export async function getBusiestTimes(
  scope: EngagementScope
): Promise<{ byWeekday: number[]; byHour: number[] }> {
  const rows = await prisma.$queryRaw<Array<{ dow: number; hour: number; views: number }>>(Prisma.sql`
    SELECT EXTRACT(ISODOW FROM (e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London')::int AS dow,
           EXTRACT(HOUR FROM (e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London')::int AS hour,
           COUNT(*)::int AS views
    FROM "EngagementEvent" e
    WHERE e."event" = ${VIEW_EVENT}
      ${scope.startDate ? Prisma.sql`AND e."createdAt" >= ${scope.startDate}` : Prisma.empty}
      ${scope.surgeryId ? Prisma.sql`AND e."surgeryId" = ${scope.surgeryId}` : Prisma.empty}
      ${liveOnlySql(scope)}
    GROUP BY 1, 2
  `)
  return toWeekdayHourArrays(rows)
}

/**
 * The symptoms a scope reports on: the library as it stands today, so every
 * symptom figure on the tab is measured against the same denominator.
 * Retired (soft-deleted) symptoms are excluded, as are custom symptoms —
 * views are only recorded for base symptoms (see src/app/symptom/[id]/page.tsx),
 * so custom ones would all falsely register as never viewed.
 */
async function getTrackedSymptoms(
  scope: EngagementScope
): Promise<Array<{ id: string; name: string; ageGroup: string }>> {
  // Keyed by base symptom id: an override and its base resolve to the same
  // tracked symptom, and counting it twice would break the reconciliation
  // between "symptoms accessed" and "never viewed".
  const tracked = new Map<string, { id: string; name: string; ageGroup: string }>()
  if (scope.surgeryId) {
    const symptoms = await getCachedEffectiveSymptoms(scope.surgeryId)
    for (const s of symptoms) {
      if (s.source === 'custom') continue
      const id = s.baseSymptomId ?? s.id
      if (!tracked.has(id)) tracked.set(id, { id, name: s.name, ageGroup: s.ageGroup })
    }
  } else {
    const base = await prisma.baseSymptom.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, ageGroup: true },
    })
    for (const s of base) tracked.set(s.id, s)
  }
  return [...tracked.values()]
}

export interface SymptomInsights {
  /** Most viewed tracked symptoms, highest first; excludes never-viewed ones. */
  topViewed: EngagementRankedSymptom[]
  leastViewed: EngagementRankedSymptom[]
  neverViewedCount: number
  trackedSymptomCount: number
  /** Tracked symptoms with at least one view — the "Symptoms accessed" tile. */
  viewedSymptomCount: number
}

/**
 * Both symptom leaderboards and the coverage counts, from a single pass over
 * the tracked library. Sharing one ranking guarantees the tile, the top list
 * and the least-viewed card can never disagree, and the name tiebreak keeps
 * equal-count rows in a stable order between refreshes.
 */
export async function getSymptomInsights(
  scope: EngagementScope,
  { topTake = 10, leastTake = 8 }: { topTake?: number; leastTake?: number } = {}
): Promise<SymptomInsights> {
  const [tracked, grouped] = await Promise.all([
    getTrackedSymptoms(scope),
    prisma.engagementEvent.groupBy({
      by: ['baseId'],
      where: engagementWhere(scope),
      _count: { baseId: true },
    }),
  ])
  const counts = new Map(grouped.map(g => [g.baseId, g._count.baseId]))

  const rows: EngagementRankedSymptom[] = tracked.map(t => ({
    ...t,
    viewCount: counts.get(t.id) ?? 0,
  }))
  const byName = (a: EngagementRankedSymptom, b: EngagementRankedSymptom) =>
    a.name.localeCompare(b.name)
  const ascending = [...rows].sort((a, b) => a.viewCount - b.viewCount || byName(a, b))
  const descending = [...rows].sort((a, b) => b.viewCount - a.viewCount || byName(a, b))
  const neverViewedCount = rows.filter(r => r.viewCount === 0).length

  return {
    topViewed: descending.filter(r => r.viewCount > 0).slice(0, topTake),
    leastViewed: ascending.slice(0, leastTake),
    neverViewedCount,
    trackedSymptomCount: rows.length,
    viewedSymptomCount: rows.length - neverViewedCount,
  }
}

/** Convenience wrapper: everything the route needs beyond the top user list. */
export async function getEngagementExtras(
  scope: EngagementScope,
  now: Date = new Date(),
  { topTake = 10 }: { topTake?: number } = {}
) {
  const [volume, previousTotals, trend, busiestTimes, symptomInsights] = await Promise.all([
    getTotals(scope),
    getPreviousTotals(scope),
    getDailyTrend(scope, now),
    getBusiestTimes(scope),
    getSymptomInsights(scope, { topTake }),
  ])
  const { topViewed, viewedSymptomCount, ...insights } = symptomInsights
  return {
    topSymptoms: topViewed,
    totals: { ...volume, distinctSymptoms: viewedSymptomCount },
    previousTotals,
    trend,
    insights: { ...insights, ...busiestTimes },
  }
}
