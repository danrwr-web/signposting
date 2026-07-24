import { NextRequest } from 'next/server'
import { GET } from '../route'
import { refreshPracticeListSizes } from '@/server/practiceListSize'

jest.mock('@/server/practiceListSize', () => {
  class PracticeDataRefreshError extends Error {
    constructor(public clientMessage: string, serverDetails: string) {
      super(serverDetails)
      this.name = 'PracticeDataRefreshError'
    }
  }
  return { refreshPracticeListSizes: jest.fn(), PracticeDataRefreshError }
})

const mockedRefresh = refreshPracticeListSizes as jest.MockedFunction<
  typeof refreshPracticeListSizes
>

function makeReq(authorization?: string) {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'authorization' ? authorization ?? null : null,
    },
  } as unknown as NextRequest
}

describe('GET /api/cron/refresh-practice-data', () => {
  const originalSecret = process.env.CRON_SECRET

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    mockedRefresh.mockResolvedValue({
      count: 6500,
      skipped: 0,
      extractDate: '2026-07-01T00:00:00.000Z',
      sourceUrl: 'https://files.digital.nhs.uk/a/gp-reg-pat-prac-all.csv',
      diagnostics: [],
    })
  })

  afterAll(() => {
    process.env.CRON_SECRET = originalSecret
  })

  it('returns 500 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(makeReq('Bearer anything'))
    expect(res.status).toBe(500)
    expect(mockedRefresh).not.toHaveBeenCalled()
  })

  it('returns 401 for a missing or wrong bearer token', async () => {
    expect((await GET(makeReq())).status).toBe(401)
    expect((await GET(makeReq('Bearer wrong'))).status).toBe(401)
    expect(mockedRefresh).not.toHaveBeenCalled()
  })

  it('runs the refresh with the correct bearer token', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    const res = await GET(makeReq('Bearer test-secret'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ count: 6500 })
  })
})
