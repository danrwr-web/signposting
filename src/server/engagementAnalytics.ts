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
  EngagementTotals,
  EngagementTrendPoint,
  EngagementTopRes,
} from '@/lib/api-contracts'

const VIEW_EVENT = 'view_symptom'

/** All-time trend requests are capped to this many most-recent days. */
export const TREND_CAP_DAYS = 90

export interface EngagementScope {
  /** null = all surgeries (superuser overview) */
  surgeryId: string | null
  /** null = all time */
  startDate: Date | null
}

function baseWhere(scope: EngagementScope): Prisma.EngagementEventWhereInput {
  const where: Prisma.EngagementEventWhereInput = { event: VIEW_EVENT }
  if (scope.surgeryId) where.surgeryId = scope.surgeryId
  if (scope.startDate) where.createdAt = { gte: scope.startDate }
  return where
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

/** Calendar date (YYYY-MM-DD) of an instant, in Europe/London. */
export function londonDay(instant: Date): string {
  return londonDayFormat.format(instant)
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
  // Stepping at UTC noon keeps the walk immune to DST transitions.
  while (day <= endDay && points.length <= 400) {
    points.push({ date: day, views: counts.get(day) ?? 0 })
    const next = new Date(`${day}T12:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    day = next.toISOString().slice(0, 10)
  }
  return points
}

/** The same-length window immediately before [start, now). */
export function previousWindow(start: Date, now: Date): { start: Date; end: Date } {
  return { start: new Date(start.getTime() - (now.getTime() - start.getTime())), end: start }
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

export async function getTotals(scope: EngagementScope): Promise<EngagementTotals> {
  const where = baseWhere(scope)
  const [totalViews, users, symptoms, surgeries] = await Promise.all([
    prisma.engagementEvent.count({ where }),
    prisma.engagementEvent.groupBy({
      by: ['userEmail'],
      where: { ...where, userEmail: { not: null } },
    }),
    prisma.engagementEvent.groupBy({ by: ['baseId'], where }),
    scope.surgeryId
      ? Promise.resolve(null)
      : prisma.engagementEvent.groupBy({
          by: ['surgeryId'],
          where: { ...where, surgeryId: { not: null } },
        }),
  ])
  return {
    totalViews,
    distinctUsers: users.length,
    distinctSymptoms: symptoms.length,
    activeSurgeries: surgeries ? surgeries.length : null,
  }
}

export async function getPreviousTotals(
  scope: EngagementScope,
  now: Date = new Date()
): Promise<EngagementTopRes['previousTotals']> {
  if (!scope.startDate) return null
  const window = previousWindow(scope.startDate, now)
  const where: Prisma.EngagementEventWhereInput = {
    event: VIEW_EVENT,
    createdAt: { gte: window.start, lt: window.end },
  }
  if (scope.surgeryId) where.surgeryId = scope.surgeryId
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
    scope.startDate ?? new Date(now.getTime() - TREND_CAP_DAYS * 24 * 60 * 60 * 1000)
  // COUNT(*) comes back as BigInt without the ::int cast, which
  // NextResponse.json cannot serialise.
  const rows = await prisma.$queryRaw<Array<{ day: string; views: number }>>(Prisma.sql`
    SELECT to_char((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London')::date, 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS views
    FROM "EngagementEvent"
    WHERE "event" = ${VIEW_EVENT}
      AND "createdAt" >= ${start}
      ${scope.surgeryId ? Prisma.sql`AND "surgeryId" = ${scope.surgeryId}` : Prisma.empty}
    GROUP BY 1
    ORDER BY 1
  `)
  return { bucket: 'day', capped, points: fillDaySeries(rows, start, now) }
}

export async function getBusiestTimes(
  scope: EngagementScope
): Promise<{ byWeekday: number[]; byHour: number[] }> {
  const rows = await prisma.$queryRaw<Array<{ dow: number; hour: number; views: number }>>(Prisma.sql`
    SELECT EXTRACT(ISODOW FROM ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London')::int AS dow,
           EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London')::int AS hour,
           COUNT(*)::int AS views
    FROM "EngagementEvent"
    WHERE "event" = ${VIEW_EVENT}
      ${scope.startDate ? Prisma.sql`AND "createdAt" >= ${scope.startDate}` : Prisma.empty}
      ${scope.surgeryId ? Prisma.sql`AND "surgeryId" = ${scope.surgeryId}` : Prisma.empty}
    GROUP BY 1, 2
  `)
  return toWeekdayHourArrays(rows)
}

/**
 * Least-viewed symptoms in the period, measured against the symptoms the
 * scope can actually see. Custom symptoms are excluded because symptom views
 * are only recorded for base symptoms (see src/app/symptom/[id]/page.tsx),
 * so they would all falsely register as never viewed.
 */
export async function getLeastViewedSymptoms(
  scope: EngagementScope,
  take = 8
): Promise<Pick<EngagementTopRes['insights'], 'leastViewed' | 'neverViewedCount' | 'trackedSymptomCount'>> {
  const tracked: Array<{ id: string; name: string; ageGroup: string }> = []
  if (scope.surgeryId) {
    const symptoms = await getCachedEffectiveSymptoms(scope.surgeryId)
    for (const s of symptoms) {
      if (s.source === 'custom') continue
      tracked.push({ id: s.baseSymptomId ?? s.id, name: s.name, ageGroup: s.ageGroup })
    }
  } else {
    const base = await prisma.baseSymptom.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, ageGroup: true },
    })
    tracked.push(...base)
  }

  const grouped = await prisma.engagementEvent.groupBy({
    by: ['baseId'],
    where: baseWhere(scope),
    _count: { baseId: true },
  })
  const counts = new Map(grouped.map(g => [g.baseId, g._count.baseId]))

  const rows = tracked.map(t => ({ ...t, viewCount: counts.get(t.id) ?? 0 }))
  rows.sort((a, b) => a.viewCount - b.viewCount || a.name.localeCompare(b.name))
  return {
    leastViewed: rows.slice(0, take),
    neverViewedCount: rows.filter(r => r.viewCount === 0).length,
    trackedSymptomCount: rows.length,
  }
}

/** Convenience wrapper: everything the route needs beyond the top lists. */
export async function getEngagementExtras(scope: EngagementScope, now: Date = new Date()) {
  const [totals, previousTotals, trend, busiestTimes, leastViewed] = await Promise.all([
    getTotals(scope),
    getPreviousTotals(scope, now),
    getDailyTrend(scope, now),
    getBusiestTimes(scope),
    getLeastViewedSymptoms(scope),
  ])
  return {
    totals,
    previousTotals,
    trend,
    insights: { ...leastViewed, ...busiestTimes },
  }
}
