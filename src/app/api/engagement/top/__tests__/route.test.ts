import { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/server/auth'
import { getSessionUser, can } from '@/lib/rbac'
import { getEngagementExtras, resolveRange } from '@/server/engagementAnalytics'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    engagementEvent: {
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    baseSymptom: { findMany: jest.fn() },
    surgery: { findMany: jest.fn() },
  },
}))

jest.mock('@/server/auth', () => ({
  getSession: jest.fn(),
}))

const mockedCookieGet = jest.fn()
jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({ get: (name: string) => mockedCookieGet(name) })),
}))

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
  can: jest.fn(),
}))

// The aggregation itself is covered in src/server/__tests__/engagementAnalytics.test.ts;
// here the fakes just have to carry the scope the route builds.
jest.mock('@/server/engagementAnalytics', () => ({
  getEngagementExtras: jest.fn(),
  resolveRange: jest.fn(() => ({ start: null, previousWindow: null })),
  engagementWhere: jest.fn((scope: { surgeryId: string | null }) => ({
    event: 'view_symptom',
    ...(scope.surgeryId ? { surgeryId: scope.surgeryId } : {}),
  })),
}))

const mockedGetSession = getSession as jest.MockedFunction<typeof getSession>
const mockedGetExtras = getEngagementExtras as jest.MockedFunction<typeof getEngagementExtras>
const mockedResolveRange = resolveRange as jest.MockedFunction<typeof resolveRange>
const mockedGroupBy = prisma.engagementEvent.groupBy as jest.Mock
const mockedSurgeryFindMany = prisma.surgery.findMany as jest.Mock

const makeReq = (url: string) => ({ url } as unknown as NextRequest)

const EXTRAS = {
  topSymptoms: [{ id: 'b1', name: 'Back Pain', ageGroup: 'Adult', viewCount: 5 }],
  totals: {
    totalViews: 42,
    signedInViews: 31,
    distinctUsers: 5,
    distinctSymptoms: 7,
    activeSurgeries: null,
  },
  previousTotals: { totalViews: 30, distinctUsers: 4 },
  trend: { bucket: 'day' as const, capped: false, points: [{ date: '2026-07-22', views: 42 }] },
  insights: {
    leastViewed: [],
    neverViewedCount: 0,
    trackedSymptomCount: 7,
    byWeekday: Array(7).fill(0),
    byHour: Array(24).fill(0),
  },
}

/** The scope the route hands the aggregation layer. */
const expectScope = (over: Record<string, unknown> = {}) => ({
  surgeryId: null,
  startDate: null,
  previousWindow: null,
  includeTestSurgeries: false,
  ...over,
})

describe('GET /api/engagement/top', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetExtras.mockResolvedValue(EXTRAS)
    mockedResolveRange.mockReturnValue({ start: null, previousWindow: null })
    mockedGroupBy.mockResolvedValue([])
    mockedSurgeryFindMany.mockResolvedValue([])
    // Default: legacy admin cookie present, so surgery sessions are trusted
    mockedCookieGet.mockReturnValue({ value: 'legacy-session' })
    ;(getSessionUser as jest.Mock).mockResolvedValue(null)
    ;(can as jest.Mock).mockReturnValue({ manageSurgery: () => false })
  })

  it('returns 401 when there is no session', async () => {
    mockedGetSession.mockResolvedValue(null)
    const res = await GET(makeReq('http://localhost/api/engagement/top'))
    expect(res.status).toBe(401)
  })

  it('forces surgery sessions to their own surgery scope', async () => {
    mockedGetSession.mockResolvedValue({ type: 'surgery', id: 'sur-1', surgeryId: 'sur-1' })
    const res = await GET(makeReq('http://localhost/api/engagement/top?limit=10'))
    expect(res.status).toBe(200)
    expect(mockedGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ surgeryId: 'sur-1' }),
      })
    )
    expect(mockedGetExtras).toHaveBeenCalledWith(
      expectScope({ surgeryId: 'sur-1' }),
      expect.any(Date),
      { topTake: 10 }
    )
  })

  it('rejects a surgery session requesting another surgery', async () => {
    mockedGetSession.mockResolvedValue({ type: 'surgery', id: 'sur-1', surgeryId: 'sur-1' })
    const res = await GET(makeReq('http://localhost/api/engagement/top?surgeryId=sur-2'))
    expect(res.status).toBe(403)
  })

  it('never includes the surgery breakdown for surgery sessions', async () => {
    mockedGetSession.mockResolvedValue({ type: 'surgery', id: 'sur-1', surgeryId: 'sur-1' })
    const res = await GET(
      makeReq('http://localhost/api/engagement/top?includeSurgeryBreakdown=true')
    )
    const json = await res.json()
    expect(json.surgeryBreakdown).toBeUndefined()
  })

  it('rejects a NextAuth-derived surgery session without an admin membership', async () => {
    // getSession() maps standard NextAuth users with a default surgery into a
    // 'surgery' session; without the legacy admin cookie they need ADMIN rights
    mockedGetSession.mockResolvedValue({ type: 'surgery', id: 'u1', surgeryId: 'sur-1' })
    mockedCookieGet.mockReturnValue(undefined)
    ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 'u1', memberships: [] })
    ;(can as jest.Mock).mockReturnValue({ manageSurgery: () => false })

    const res = await GET(makeReq('http://localhost/api/engagement/top'))
    expect(res.status).toBe(403)
  })

  it('allows a NextAuth surgery admin without the legacy cookie', async () => {
    mockedGetSession.mockResolvedValue({ type: 'surgery', id: 'u1', surgeryId: 'sur-1' })
    mockedCookieGet.mockReturnValue(undefined)
    ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 'u1', memberships: [] })
    const manageSurgery = jest.fn(() => true)
    ;(can as jest.Mock).mockReturnValue({ manageSurgery })

    const res = await GET(makeReq('http://localhost/api/engagement/top'))
    expect(res.status).toBe(200)
    expect(manageSurgery).toHaveBeenCalledWith('sur-1')
  })

  it('lets superusers query all surgeries with a breakdown', async () => {
    mockedGetSession.mockResolvedValue({ type: 'superuser', id: 'u1' })
    mockedGroupBy
      .mockResolvedValueOnce([]) // top users
      .mockResolvedValueOnce([{ surgeryId: 'sur-1', _count: { surgeryId: 9 } }]) // breakdown
    mockedSurgeryFindMany.mockResolvedValue([{ id: 'sur-1', name: 'Mount Pleasant', slug: 'mp' }])

    const res = await GET(
      makeReq('http://localhost/api/engagement/top?includeSurgeryBreakdown=true')
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.surgeryBreakdown).toEqual([
      { surgeryId: 'sur-1', surgeryName: 'Mount Pleasant', surgerySlug: 'mp', engagementCount: 9 },
    ])
    expect(mockedGetExtras).toHaveBeenCalledWith(expectScope(), expect.any(Date), { topTake: 10 })
  })

  it('includes totals, trend, insights and the symptom leaderboard in the response', async () => {
    mockedGetSession.mockResolvedValue({ type: 'superuser', id: 'u1' })
    const res = await GET(makeReq('http://localhost/api/engagement/top'))
    const json = await res.json()
    expect(json.totals).toEqual(EXTRAS.totals)
    expect(json.previousTotals).toEqual(EXTRAS.previousTotals)
    expect(json.trend).toEqual(EXTRAS.trend)
    expect(json.insights).toEqual(EXTRAS.insights)
    // Ranked from the same tracked library as the tile and the least-viewed card.
    expect(json.topSymptoms).toEqual(EXTRAS.topSymptoms)
  })

  it('falls back to the default limit when the limit param is invalid', async () => {
    mockedGetSession.mockResolvedValue({ type: 'superuser', id: 'u1' })
    await GET(makeReq('http://localhost/api/engagement/top?limit=9999'))
    expect(mockedGroupBy).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }))
  })

  it('resolves the window from the named range, not a caller-supplied date', async () => {
    mockedGetSession.mockResolvedValue({ type: 'superuser', id: 'u1' })
    const start = new Date('2026-08-23T23:00:00.000Z')
    mockedResolveRange.mockReturnValue({
      start,
      previousWindow: { start: new Date('2026-08-16T23:00:00.000Z'), end: start },
    })

    await GET(makeReq('http://localhost/api/engagement/top?range=7d'))
    expect(mockedResolveRange).toHaveBeenCalledWith('7d', expect.any(Date))
    expect(mockedGetExtras).toHaveBeenCalledWith(
      expectScope({
        startDate: start,
        previousWindow: { start: new Date('2026-08-16T23:00:00.000Z'), end: start },
      }),
      expect.any(Date),
      { topTake: 10 }
    )
  })

  it('falls back to the default range when the range param is invalid', async () => {
    mockedGetSession.mockResolvedValue({ type: 'superuser', id: 'u1' })
    await GET(makeReq('http://localhost/api/engagement/top?range=last-tuesday'))
    expect(mockedResolveRange).toHaveBeenCalledWith('30d', expect.any(Date))
  })

  it('excludes test surgeries from the overview unless asked', async () => {
    mockedGetSession.mockResolvedValue({ type: 'superuser', id: 'u1' })

    await GET(makeReq('http://localhost/api/engagement/top'))
    expect(mockedGetExtras).toHaveBeenCalledWith(
      expectScope({ includeTestSurgeries: false }),
      expect.any(Date),
      { topTake: 10 }
    )

    await GET(makeReq('http://localhost/api/engagement/top?includeTestSurgeries=true'))
    expect(mockedGetExtras).toHaveBeenLastCalledWith(
      expectScope({ includeTestSurgeries: true }),
      expect.any(Date),
      { topTake: 10 }
    )
  })

  it('ignores includeTestSurgeries from a surgery session', async () => {
    mockedGetSession.mockResolvedValue({ type: 'surgery', id: 'sur-1', surgeryId: 'sur-1' })
    await GET(makeReq('http://localhost/api/engagement/top?includeTestSurgeries=true'))
    expect(mockedGetExtras).toHaveBeenCalledWith(
      expectScope({ surgeryId: 'sur-1', includeTestSurgeries: false }),
      expect.any(Date),
      { topTake: 10 }
    )
  })
})
