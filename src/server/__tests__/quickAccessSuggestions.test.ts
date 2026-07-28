import { getTopViewedQuickAccessItems } from '@/server/quickAccessSuggestions'
import { prisma } from '@/lib/prisma'
import { getCachedEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { COMMON_REASONS_MAX } from '@/lib/commonReasonsShared'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    engagementEvent: {
      groupBy: jest.fn(),
    },
  },
}))

jest.mock('@/server/effectiveSymptoms', () => ({
  getCachedEffectiveSymptoms: jest.fn(),
}))

const mockedGroupBy = prisma.engagementEvent.groupBy as jest.Mock
const mockedEffective = getCachedEffectiveSymptoms as jest.Mock

const grouped = (rows: Array<[string, number]>) =>
  rows.map(([baseId, count]) => ({ baseId, _count: { baseId: count } }))

const effective = (
  id: string,
  overrides: Partial<{ name: string; source: string; isHidden: boolean; ageGroup: string }> = {}
) => ({
  id,
  name: overrides.name ?? `Symptom ${id}`,
  ageGroup: overrides.ageGroup ?? 'Adult',
  source: overrides.source ?? 'base',
  isHidden: overrides.isHidden,
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('getTopViewedQuickAccessItems', () => {
  it('returns the most viewed symptoms in view-count order with effective names', async () => {
    mockedGroupBy.mockResolvedValue(grouped([['b', 10], ['a', 7], ['c', 3]]))
    mockedEffective.mockResolvedValue([
      effective('a', { name: 'Cough (renamed)', source: 'override' }),
      effective('b'),
      effective('c'),
    ])

    const result = await getTopViewedQuickAccessItems('sur-1')

    expect(result).toEqual([
      { symptomId: 'b', name: 'Symptom b', ageGroup: 'Adult', viewCount: 10 },
      { symptomId: 'a', name: 'Cough (renamed)', ageGroup: 'Adult', viewCount: 7 },
      { symptomId: 'c', name: 'Symptom c', ageGroup: 'Adult', viewCount: 3 },
    ])
  })

  it('queries a rolling 30-day window for the surgery by default', async () => {
    mockedGroupBy.mockResolvedValue([])
    const before = Date.now()
    await getTopViewedQuickAccessItems('sur-1')

    const args = mockedGroupBy.mock.calls[0][0]
    expect(args.where.surgeryId).toBe('sur-1')
    expect(args.where.event).toBe('view_symptom')
    const gte = args.where.createdAt.gte as Date
    const expected = before - 30 * 24 * 60 * 60 * 1000
    expect(Math.abs(gte.getTime() - expected)).toBeLessThan(5000)
    expect(args.orderBy).toEqual({ _count: { baseId: 'desc' } })
  })

  it('skips symptoms hidden for the surgery and ids not in the effective list', async () => {
    mockedGroupBy.mockResolvedValue(grouped([['hidden', 20], ['gone', 15], ['ok', 5]]))
    mockedEffective.mockResolvedValue([
      effective('hidden', { isHidden: true }),
      effective('ok'),
    ])

    const result = await getTopViewedQuickAccessItems('sur-1')
    expect(result.map(r => r.symptomId)).toEqual(['ok'])
  })

  it('never suggests custom symptoms even if an id collides', async () => {
    mockedGroupBy.mockResolvedValue(grouped([['x', 9]]))
    mockedEffective.mockResolvedValue([effective('x', { source: 'custom' })])

    const result = await getTopViewedQuickAccessItems('sur-1')
    expect(result).toEqual([])
  })

  it('caps the result at COMMON_REASONS_MAX after filtering', async () => {
    const rows: Array<[string, number]> = Array.from({ length: 10 }, (_, i) => [`s${i}`, 100 - i])
    mockedGroupBy.mockResolvedValue(grouped(rows))
    mockedEffective.mockResolvedValue(rows.map(([id]) => effective(id)))

    const result = await getTopViewedQuickAccessItems('sur-1')
    expect(result.length).toBe(COMMON_REASONS_MAX)
    expect(result[0].symptomId).toBe('s0')
    // Oversampled fetch so filtered-out symptoms don't shrink the list
    expect(mockedGroupBy.mock.calls[0][0].take).toBeGreaterThan(COMMON_REASONS_MAX)
  })

  it('returns an empty list without loading symptoms when there are no events', async () => {
    mockedGroupBy.mockResolvedValue([])
    const result = await getTopViewedQuickAccessItems('sur-1')
    expect(result).toEqual([])
    expect(mockedEffective).not.toHaveBeenCalled()
  })
})
