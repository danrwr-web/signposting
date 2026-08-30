import {
  fillDaySeries,
  resolveRange,
  toWeekdayHourArrays,
  londonDay,
  londonMidnight,
  shiftDay,
  getSymptomInsights,
  getTileTotals,
  getDailyTrend,
  type EngagementScope,
} from '@/server/engagementAnalytics'
import { prisma } from '@/lib/prisma'
import { getCachedEffectiveSymptoms } from '@/server/effectiveSymptoms'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    engagementEvent: {
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    baseSymptom: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  },
}))

jest.mock('@/server/effectiveSymptoms', () => ({
  getCachedEffectiveSymptoms: jest.fn(),
}))

const mockedGroupBy = prisma.engagementEvent.groupBy as jest.Mock
const mockedCount = prisma.engagementEvent.count as jest.Mock
const mockedBaseFindMany = prisma.baseSymptom.findMany as jest.Mock
const mockedQueryRaw = prisma.$queryRaw as unknown as jest.Mock
const mockedEffective = getCachedEffectiveSymptoms as jest.Mock

/** All-surgeries, all-time, live practices only — override what a test needs. */
const scope = (over: Partial<EngagementScope> = {}): EngagementScope => ({
  surgeryId: null,
  startDate: null,
  previousWindow: null,
  includeTestSurgeries: false,
  ...over,
})

const LIVE_ONLY = { surgery: { is: { surgeryType: 'LIVE' } } }

beforeEach(() => {
  jest.clearAllMocks()
})

describe('fillDaySeries', () => {
  it('fills gaps with zero-view days', () => {
    const start = new Date('2026-07-20T00:00:00Z')
    const end = new Date('2026-07-23T12:00:00Z')
    const points = fillDaySeries([{ day: '2026-07-21', views: 4 }], start, end)
    expect(points).toEqual([
      { date: '2026-07-20', views: 0 },
      { date: '2026-07-21', views: 4 },
      { date: '2026-07-22', views: 0 },
      { date: '2026-07-23', views: 0 },
    ])
  })

  it('walks calendar days correctly across the BST transition', () => {
    // UK clocks go forward on 29 March 2026
    const start = new Date('2026-03-28T00:00:00Z')
    const end = new Date('2026-03-31T12:00:00Z')
    const points = fillDaySeries([], start, end)
    expect(points.map(p => p.date)).toEqual([
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
    ])
  })

  it('uses the London calendar day for UTC instants', () => {
    // 23:30 UTC on a BST date is 00:30 the next day in London
    expect(londonDay(new Date('2026-07-20T23:30:00Z'))).toBe('2026-07-21')
    // ...but the same day during GMT
    expect(londonDay(new Date('2026-01-20T23:30:00Z'))).toBe('2026-01-20')
  })
})

describe('londonMidnight', () => {
  it('resolves to 00:00 UTC for a GMT day', () => {
    expect(londonMidnight('2026-01-15').toISOString()).toBe('2026-01-15T00:00:00.000Z')
  })

  it('resolves to 23:00 UTC the previous day for a BST day', () => {
    expect(londonMidnight('2026-07-15').toISOString()).toBe('2026-07-14T23:00:00.000Z')
  })

  it('lands on the correct side of the spring-forward transition', () => {
    // Clocks go forward at 01:00 GMT on 29 March 2026, so that day starts at 00:00 UTC
    expect(londonMidnight('2026-03-29').toISOString()).toBe('2026-03-29T00:00:00.000Z')
    expect(londonMidnight('2026-03-30').toISOString()).toBe('2026-03-29T23:00:00.000Z')
  })

  it('lands on the correct side of the autumn transition', () => {
    // Clocks go back at 02:00 BST on 25 October 2026
    expect(londonMidnight('2026-10-25').toISOString()).toBe('2026-10-24T23:00:00.000Z')
    expect(londonMidnight('2026-10-26').toISOString()).toBe('2026-10-26T00:00:00.000Z')
  })
})

describe('resolveRange', () => {
  it('covers whole London days, so a 7-day range is exactly 7 buckets', () => {
    const now = new Date('2026-08-30T14:20:00Z')
    const { start } = resolveRange('7d', now)
    expect(londonDay(start!)).toBe('2026-08-24')
    // The window must not start mid-day: the first bucket would under-report.
    expect(start!.toISOString()).toBe('2026-08-23T23:00:00.000Z')
    expect(fillDaySeries([], start!, now)).toHaveLength(7)
  })

  it('compares against the equal-length window immediately before', () => {
    const now = new Date('2026-08-30T14:20:00Z')
    const { start, previousWindow } = resolveRange('7d', now)
    expect(previousWindow!.end).toEqual(start)
    expect(londonDay(previousWindow!.start)).toBe('2026-08-17')
    expect(fillDaySeries([], previousWindow!.start, previousWindow!.end)).toHaveLength(8)
  })

  it('is unbounded for the all-time range', () => {
    expect(resolveRange('all', new Date('2026-08-30T14:20:00Z'))).toEqual({
      start: null,
      previousWindow: null,
    })
  })

  it('shifts calendar days across month boundaries', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('toWeekdayHourArrays', () => {
  it('pivots ISODOW/hour rows into Monday-first weekday and hour arrays', () => {
    const { byWeekday, byHour } = toWeekdayHourArrays([
      { dow: 1, hour: 9, views: 3 },
      { dow: 1, hour: 10, views: 2 },
      { dow: 7, hour: 9, views: 1 },
    ])
    expect(byWeekday[0]).toBe(5)
    expect(byWeekday[6]).toBe(1)
    expect(byHour[9]).toBe(4)
    expect(byHour[10]).toBe(2)
  })

  it('ignores out-of-range rows', () => {
    const { byWeekday, byHour } = toWeekdayHourArrays([{ dow: 0, hour: 99, views: 5 }])
    expect(byWeekday.every(v => v === 0)).toBe(true)
    expect(byHour.every(v => v === 0)).toBe(true)
  })
})

describe('test surgery scoping', () => {
  beforeEach(() => {
    mockedGroupBy.mockResolvedValue([])
    mockedQueryRaw.mockResolvedValue([])
    mockedBaseFindMany.mockResolvedValue([])
  })

  const sqlOf = (call: number) => mockedQueryRaw.mock.calls[call][0].strings.join('')

  it('narrows the all-surgeries overview to live practices by default', async () => {
    await getTileTotals(scope())
    expect(sqlOf(0)).toContain('"surgeryType" = \'LIVE\'')
  })

  it('includes test practices when asked', async () => {
    await getTileTotals(scope({ includeTestSurgeries: true }))
    expect(sqlOf(0)).not.toContain('surgeryType')
  })

  it('always reports on an explicitly selected surgery, whatever its type', async () => {
    await getTileTotals(scope({ surgeryId: 'test-surgery' }))
    expect(sqlOf(0)).not.toContain('surgeryType')
  })

  it('narrows the symptom ranking too', async () => {
    await getSymptomInsights(scope())
    expect(mockedGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining(LIVE_ONLY) })
    )
  })

  it('narrows the hand-written aggregates too', async () => {
    await getDailyTrend(scope(), new Date('2026-08-30T14:20:00Z'))
    expect(sqlOf(0)).toContain('"surgeryType" = \'LIVE\'')

    mockedQueryRaw.mockClear()
    await getDailyTrend(scope({ includeTestSurgeries: true }), new Date('2026-08-30T14:20:00Z'))
    expect(sqlOf(0)).not.toContain('surgeryType')
  })
})

describe('getSymptomInsights', () => {
  it('excludes custom symptoms and keys overrides by their base symptom id', async () => {
    mockedEffective.mockResolvedValue([
      { id: 'b1', name: 'Back Pain', ageGroup: 'Adult', source: 'base' },
      { id: 'ov1', baseSymptomId: 'b2', name: 'Tummy Ache', ageGroup: 'U5', source: 'override' },
      { id: 'c1', name: 'Custom Thing', ageGroup: 'Adult', source: 'custom' },
    ])
    mockedGroupBy.mockResolvedValue([{ baseId: 'b2', _count: { baseId: 6 } }])

    const result = await getSymptomInsights(scope({ surgeryId: 'sur-1' }))

    expect(result.trackedSymptomCount).toBe(2)
    expect(result.leastViewed.map(s => s.name)).toEqual(['Back Pain', 'Tummy Ache'])
    expect(result.leastViewed[0].viewCount).toBe(0)
    expect(result.leastViewed[1].viewCount).toBe(6)
    expect(result.neverViewedCount).toBe(1)
  })

  it('counts an override and its base as one tracked symptom', async () => {
    mockedEffective.mockResolvedValue([
      { id: 'b1', name: 'Back Pain', ageGroup: 'Adult', source: 'base' },
      { id: 'ov1', baseSymptomId: 'b1', name: 'Back Pain', ageGroup: 'Adult', source: 'override' },
    ])
    mockedGroupBy.mockResolvedValue([{ baseId: 'b1', _count: { baseId: 4 } }])

    const result = await getSymptomInsights(scope({ surgeryId: 'sur-1' }))
    expect(result.trackedSymptomCount).toBe(1)
    expect(result.viewedSymptomCount).toBe(1)
  })

  it('leaves retired symptoms out of the tracked library', async () => {
    mockedBaseFindMany.mockResolvedValue([{ id: 'b1', name: 'Ear Ache', ageGroup: 'O5' }])
    mockedGroupBy.mockResolvedValue([])

    const result = await getSymptomInsights(scope())

    expect(mockedEffective).not.toHaveBeenCalled()
    expect(mockedBaseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isDeleted: false } })
    )
    expect(result.leastViewed).toEqual([
      { id: 'b1', name: 'Ear Ache', ageGroup: 'O5', viewCount: 0 },
    ])
    expect(result.neverViewedCount).toBe(1)
  })

  it('sorts zero-view symptoms first, then by name', async () => {
    mockedEffective.mockResolvedValue([
      { id: 'b1', name: 'Zebra', ageGroup: 'Adult', source: 'base' },
      { id: 'b2', name: 'Apple', ageGroup: 'Adult', source: 'base' },
      { id: 'b3', name: 'Mango', ageGroup: 'Adult', source: 'base' },
    ])
    mockedGroupBy.mockResolvedValue([{ baseId: 'b2', _count: { baseId: 1 } }])

    const result = await getSymptomInsights(scope({ surgeryId: 'sur-1' }))
    expect(result.leastViewed.map(s => s.name)).toEqual(['Mango', 'Zebra', 'Apple'])
  })

  it('ranks the top list highest-first, breaking ties by name', async () => {
    mockedEffective.mockResolvedValue([
      { id: 'b1', name: 'Zebra', ageGroup: 'Adult', source: 'base' },
      { id: 'b2', name: 'Apple', ageGroup: 'Adult', source: 'base' },
      { id: 'b3', name: 'Mango', ageGroup: 'Adult', source: 'base' },
    ])
    mockedGroupBy.mockResolvedValue([
      { baseId: 'b1', _count: { baseId: 5 } },
      { baseId: 'b2', _count: { baseId: 5 } },
    ])

    const result = await getSymptomInsights(scope({ surgeryId: 'sur-1' }))
    // Never-viewed symptoms are not "top viewed", and equal counts are stable.
    expect(result.topViewed.map(s => s.name)).toEqual(['Apple', 'Zebra'])
  })

  it('honours the top and least list sizes independently', async () => {
    mockedEffective.mockResolvedValue(
      ['a', 'b', 'c', 'd'].map(n => ({ id: n, name: n, ageGroup: 'Adult', source: 'base' }))
    )
    mockedGroupBy.mockResolvedValue([
      { baseId: 'a', _count: { baseId: 3 } },
      { baseId: 'b', _count: { baseId: 2 } },
      { baseId: 'c', _count: { baseId: 1 } },
    ])

    const result = await getSymptomInsights(scope({ surgeryId: 'sur-1' }), {
      topTake: 2,
      leastTake: 1,
    })
    expect(result.topViewed.map(s => s.name)).toEqual(['a', 'b'])
    expect(result.leastViewed.map(s => s.name)).toEqual(['d'])
  })

  it('reconciles the symptom figures: viewed = tracked - never viewed', async () => {
    mockedEffective.mockResolvedValue(
      ['a', 'b', 'c', 'd', 'e'].map(n => ({ id: n, name: n, ageGroup: 'Adult', source: 'base' }))
    )
    // Includes a retired symptom that is no longer in the library but still has
    // events: it must not push "symptoms accessed" above the tracked total.
    mockedGroupBy.mockResolvedValue([
      { baseId: 'a', _count: { baseId: 3 } },
      { baseId: 'b', _count: { baseId: 1 } },
      { baseId: 'retired', _count: { baseId: 9 } },
    ])

    const result = await getSymptomInsights(scope({ surgeryId: 'sur-1' }))
    expect(result.trackedSymptomCount).toBe(5)
    expect(result.neverViewedCount).toBe(3)
    expect(result.viewedSymptomCount).toBe(2)
    expect(result.viewedSymptomCount).toBe(
      result.trackedSymptomCount - result.neverViewedCount
    )
    expect(result.topViewed.map(s => s.id)).not.toContain('retired')
  })
})

describe('getTileTotals', () => {
  const row = (over: Record<string, number> = {}) => [{
    totalViews: 0,
    signedInViews: 0,
    distinctUsers: 0,
    activeSurgeries: 0,
    previousViews: 0,
    previousUsers: 0,
    ...over,
  }]

  it('reads every tile figure from one aggregate', async () => {
    mockedQueryRaw.mockResolvedValue(
      row({ totalViews: 42, signedInViews: 30, distinctUsers: 2 })
    )

    const { totals } = await getTileTotals(scope({ surgeryId: 'sur-1' }))
    expect(totals).toEqual({
      totalViews: 42,
      signedInViews: 30,
      distinctUsers: 2,
      activeSurgeries: null,
    })
    // The point of the consolidation: one round trip, not six.
    expect(mockedQueryRaw).toHaveBeenCalledTimes(1)
    expect(mockedGroupBy).not.toHaveBeenCalled()
  })

  it('reports signed-in views so the unattributed remainder is visible', async () => {
    mockedQueryRaw.mockResolvedValue(row({ totalViews: 100, signedInViews: 40 }))
    const { totals } = await getTileTotals(scope({ surgeryId: 'sur-1' }))
    // 60 views came from sessions with no attributable user.
    expect(totals.totalViews - totals.signedInViews).toBe(60)
  })

  it('counts active surgeries only for the all-surgeries scope', async () => {
    mockedQueryRaw.mockResolvedValue(row({ activeSurgeries: 2 }))
    const { totals } = await getTileTotals(scope())
    expect(totals.activeSurgeries).toBe(2)
  })

  it('returns the previous window from the same pass', async () => {
    mockedQueryRaw.mockResolvedValue(
      row({ totalViews: 42, previousViews: 30, previousUsers: 4 })
    )
    const { previousTotals } = await getTileTotals(
      scope({
        startDate: new Date('2026-08-23T23:00:00Z'),
        previousWindow: {
          start: new Date('2026-08-16T23:00:00Z'),
          end: new Date('2026-08-23T23:00:00Z'),
        },
      })
    )
    expect(previousTotals).toEqual({ totalViews: 30, distinctUsers: 4 })
    expect(mockedQueryRaw).toHaveBeenCalledTimes(1)
  })

  it('has no previous window to compare against for all time', async () => {
    mockedQueryRaw.mockResolvedValue(row({ totalViews: 42 }))
    const { previousTotals } = await getTileTotals(scope())
    expect(previousTotals).toBeNull()
  })

  it('survives an empty result set', async () => {
    mockedQueryRaw.mockResolvedValue([])
    const { totals } = await getTileTotals(scope())
    expect(totals.totalViews).toBe(0)
  })
})
