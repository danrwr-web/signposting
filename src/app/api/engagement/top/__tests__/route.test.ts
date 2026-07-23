import { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/server/auth'
import { getEngagementExtras } from '@/server/engagementAnalytics'

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

jest.mock('@/server/engagementAnalytics', () => ({
  getEngagementExtras: jest.fn(),
}))

const mockedGetSession = getSession as jest.MockedFunction<typeof getSession>
const mockedGetExtras = getEngagementExtras as jest.MockedFunction<typeof getEngagementExtras>
const mockedGroupBy = prisma.engagementEvent.groupBy as jest.Mock
const mockedBaseSymptomFindMany = prisma.baseSymptom.findMany as jest.Mock
const mockedSurgeryFindMany = prisma.surgery.findMany as jest.Mock

const makeReq = (url: string) => ({ url } as unknown as NextRequest)

const EXTRAS = {
  totals: { totalViews: 42, distinctUsers: 5, distinctSymptoms: 7, activeSurgeries: null },
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

describe('GET /api/engagement/top', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetExtras.mockResolvedValue(EXTRAS)
    mockedGroupBy.mockResolvedValue([])
    mockedBaseSymptomFindMany.mockResolvedValue([])
    mockedSurgeryFindMany.mockResolvedValue([])
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
    expect(mockedGetExtras).toHaveBeenCalledWith({ surgeryId: 'sur-1', startDate: null })
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

  it('lets superusers query all surgeries with a breakdown', async () => {
    mockedGetSession.mockResolvedValue({ type: 'superuser', id: 'u1' })
    mockedGroupBy
      .mockResolvedValueOnce([]) // top symptoms
      .mockResolvedValueOnce([]) // top users
      .mockResolvedValueOnce([
        { surgeryId: 'sur-1', _count: { surgeryId: 9 } },
      ]) // breakdown
    mockedSurgeryFindMany.mockResolvedValue([{ id: 'sur-1', name: 'Mount Pleasant', slug: 'mp' }])

    const res = await GET(
      makeReq('http://localhost/api/engagement/top?includeSurgeryBreakdown=true')
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.surgeryBreakdown).toEqual([
      { surgeryId: 'sur-1', surgeryName: 'Mount Pleasant', surgerySlug: 'mp', engagementCount: 9 },
    ])
    expect(mockedGetExtras).toHaveBeenCalledWith({ surgeryId: null, startDate: null })
  })

  it('includes totals, trend and insights in the response', async () => {
    mockedGetSession.mockResolvedValue({ type: 'superuser', id: 'u1' })
    const res = await GET(makeReq('http://localhost/api/engagement/top'))
    const json = await res.json()
    expect(json.totals).toEqual(EXTRAS.totals)
    expect(json.previousTotals).toEqual(EXTRAS.previousTotals)
    expect(json.trend).toEqual(EXTRAS.trend)
    expect(json.insights).toEqual(EXTRAS.insights)
  })

  it('skips top-symptom rows whose base symptom has been deleted', async () => {
    mockedGetSession.mockResolvedValue({ type: 'superuser', id: 'u1' })
    mockedGroupBy
      .mockResolvedValueOnce([
        { baseId: 'b1', _count: { baseId: 5 } },
        { baseId: 'b-deleted', _count: { baseId: 3 } },
      ])
      .mockResolvedValueOnce([])
    mockedBaseSymptomFindMany.mockResolvedValue([{ id: 'b1', name: 'Back Pain', ageGroup: 'Adult' }])

    const res = await GET(makeReq('http://localhost/api/engagement/top'))
    const json = await res.json()
    expect(json.topSymptoms).toEqual([
      { id: 'b1', name: 'Back Pain', ageGroup: 'Adult', viewCount: 5 },
    ])
  })

  it('falls back to the default limit when the limit param is invalid', async () => {
    mockedGetSession.mockResolvedValue({ type: 'superuser', id: 'u1' })
    await GET(makeReq('http://localhost/api/engagement/top?limit=9999'))
    expect(mockedGroupBy).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }))
  })

  it('passes the start date through to scoping', async () => {
    mockedGetSession.mockResolvedValue({ type: 'superuser', id: 'u1' })
    const start = '2026-07-16T00:00:00.000Z'
    await GET(makeReq(`http://localhost/api/engagement/top?startDate=${start}`))
    expect(mockedGetExtras).toHaveBeenCalledWith({ surgeryId: null, startDate: new Date(start) })
  })
})
