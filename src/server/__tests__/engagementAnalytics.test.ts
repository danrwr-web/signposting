import {
  fillDaySeries,
  previousWindow,
  toWeekdayHourArrays,
  londonDay,
  getLeastViewedSymptoms,
  getTotals,
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
  },
}))

jest.mock('@/server/effectiveSymptoms', () => ({
  getCachedEffectiveSymptoms: jest.fn(),
}))

const mockedGroupBy = prisma.engagementEvent.groupBy as jest.Mock
const mockedCount = prisma.engagementEvent.count as jest.Mock
const mockedBaseFindMany = prisma.baseSymptom.findMany as jest.Mock
const mockedEffective = getCachedEffectiveSymptoms as jest.Mock

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

describe('previousWindow', () => {
  it('returns the same-length window immediately before the range', () => {
    const start = new Date('2026-07-16T00:00:00Z')
    const now = new Date('2026-07-23T00:00:00Z')
    const window = previousWindow(start, now)
    expect(window.start).toEqual(new Date('2026-07-09T00:00:00Z'))
    expect(window.end).toEqual(start)
  })
})

describe('toWeekdayHourArrays', () => {
  it('pivots ISODOW/hour rows into Monday-first weekday and hour arrays', () => {
    const { byWeekday, byHour } = toWeekdayHourArrays([
      { dow: 1, hour: 9, views: 3 },
      { dow: 1, hour: 14, views: 2 },
      { dow: 7, hour: 9, views: 1 },
    ])
    expect(byWeekday).toEqual([5, 0, 0, 0, 0, 0, 1])
    expect(byHour[9]).toBe(4)
    expect(byHour[14]).toBe(2)
    expect(byHour.reduce((a, b) => a + b, 0)).toBe(6)
  })

  it('ignores out-of-range rows', () => {
    const { byWeekday, byHour } = toWeekdayHourArrays([{ dow: 0, hour: 24, views: 9 }])
    expect(byWeekday.every(v => v === 0)).toBe(true)
    expect(byHour.every(v => v === 0)).toBe(true)
  })
})

describe('getLeastViewedSymptoms', () => {
  it('excludes custom symptoms and keys overrides by their base symptom id', async () => {
    mockedEffective.mockResolvedValue([
      { id: 'b1', name: 'Back Pain', ageGroup: 'Adult', source: 'base' },
      { id: 'ov1', baseSymptomId: 'b2', name: 'Tummy Ache', ageGroup: 'U5', source: 'override' },
      { id: 'c1', name: 'Custom Thing', ageGroup: 'Adult', source: 'custom' },
    ])
    mockedGroupBy.mockResolvedValue([{ baseId: 'b2', _count: { baseId: 6 } }])

    const result = await getLeastViewedSymptoms({ surgeryId: 'sur-1', startDate: null })

    expect(result.trackedSymptomCount).toBe(2)
    expect(result.leastViewed.map(s => s.name)).toEqual(['Back Pain', 'Tummy Ache'])
    expect(result.leastViewed[0].viewCount).toBe(0)
    expect(result.leastViewed[1].viewCount).toBe(6)
    expect(result.neverViewedCount).toBe(1)
  })

  it('uses the base symptom library for the all-surgeries scope', async () => {
    mockedBaseFindMany.mockResolvedValue([
      { id: 'b1', name: 'Ear Ache', ageGroup: 'O5' },
    ])
    mockedGroupBy.mockResolvedValue([])

    const result = await getLeastViewedSymptoms({ surgeryId: null, startDate: null })

    expect(mockedEffective).not.toHaveBeenCalled()
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

    const result = await getLeastViewedSymptoms({ surgeryId: 'sur-1', startDate: null })
    expect(result.leastViewed.map(s => s.name)).toEqual(['Mango', 'Zebra', 'Apple'])
  })
})

describe('getTotals', () => {
  it('computes true totals and distinct counts for a surgery scope', async () => {
    mockedCount.mockResolvedValue(42)
    mockedGroupBy
      .mockResolvedValueOnce([{ userEmail: 'a@nhs.net' }, { userEmail: 'b@nhs.net' }])
      .mockResolvedValueOnce([{ baseId: 'b1' }, { baseId: 'b2' }, { baseId: 'b3' }])

    const totals = await getTotals({ surgeryId: 'sur-1', startDate: null })
    expect(totals).toEqual({
      totalViews: 42,
      distinctUsers: 2,
      distinctSymptoms: 3,
      activeSurgeries: null,
    })
  })

  it('counts active surgeries only for the all-surgeries scope', async () => {
    mockedCount.mockResolvedValue(10)
    mockedGroupBy
      .mockResolvedValueOnce([{ userEmail: 'a@nhs.net' }])
      .mockResolvedValueOnce([{ baseId: 'b1' }])
      .mockResolvedValueOnce([{ surgeryId: 'sur-1' }, { surgeryId: 'sur-2' }])

    const totals = await getTotals({ surgeryId: null, startDate: null })
    expect(totals.activeSurgeries).toBe(2)
  })
})
