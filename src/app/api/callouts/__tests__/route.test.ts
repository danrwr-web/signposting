import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    userCalloutState: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
}))

const mockedGetSessionUser = getSessionUser as jest.MockedFunction<typeof getSessionUser>

const dbState = {
  id: 'cs1',
  userId: 'u1',
  calloutKey: 'suggest-feature-2026-07',
  firstSeenAt: new Date('2026-07-27T09:00:00Z'),
  dismissedAt: null,
}

const makePostReq = (body: unknown) =>
  ({
    url: 'http://localhost/api/callouts',
    json: async () => body,
  } as unknown as NextRequest)

describe('/api/callouts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetSessionUser.mockResolvedValue({ id: 'u1', email: 'user@example.com' } as any)
    ;(prisma.userCalloutState.findMany as jest.Mock).mockResolvedValue([dbState])
    ;(prisma.userCalloutState.upsert as jest.Mock).mockResolvedValue(dbState)
  })

  it('GET returns 401 when unauthenticated', async () => {
    mockedGetSessionUser.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('GET returns the caller\'s callout states', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.callouts).toEqual([
      {
        key: 'suggest-feature-2026-07',
        firstSeenAt: '2026-07-27T09:00:00.000Z',
        dismissedAt: null,
      },
    ])
    expect(prisma.userCalloutState.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    })
  })

  it('POST rejects an invalid action', async () => {
    const res = await POST(makePostReq({ key: 'x', action: 'bogus' }))
    expect(res.status).toBe(400)
  })

  it('POST seen upserts without touching dismissedAt', async () => {
    const res = await POST(makePostReq({ key: 'suggest-feature-2026-07', action: 'seen' }))
    expect(res.status).toBe(200)
    expect(prisma.userCalloutState.upsert).toHaveBeenCalledWith({
      where: {
        userId_calloutKey: { userId: 'u1', calloutKey: 'suggest-feature-2026-07' },
      },
      create: {
        userId: 'u1',
        calloutKey: 'suggest-feature-2026-07',
        dismissedAt: null,
      },
      update: {},
    })
  })

  it('POST dismiss stamps dismissedAt', async () => {
    const res = await POST(makePostReq({ key: 'nav-update', action: 'dismiss' }))
    expect(res.status).toBe(200)
    const args = (prisma.userCalloutState.upsert as jest.Mock).mock.calls[0][0]
    expect(args.create.dismissedAt).toBeInstanceOf(Date)
    expect(args.update.dismissedAt).toBeInstanceOf(Date)
  })
})
