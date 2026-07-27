import { NextRequest } from 'next/server'
import { GET } from '../route'
import { PATCH } from '../[id]/route'
import { prisma } from '@/lib/prisma'
import { requireSuperuser } from '@/lib/rbac'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    suggestion: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/lib/rbac', () => ({
  requireSuperuser: jest.fn(),
}))

const mockedRequireSuperuser = requireSuperuser as jest.MockedFunction<typeof requireSuperuser>

const dbSuggestion = {
  id: 'sug1',
  type: 'FEATURE',
  status: 'PENDING',
  title: 'Dark mode',
  text: 'Please add dark mode',
  createdAt: new Date('2026-07-01T10:00:00Z'),
  updatedAt: new Date('2026-07-01T10:00:00Z'),
}

const makeGetReq = (query = '') =>
  ({ url: `http://localhost/api/super/suggestions${query}` } as unknown as NextRequest)

const makePatchReq = (body: unknown) =>
  ({
    url: 'http://localhost/api/super/suggestions/sug1',
    json: async () => body,
  } as unknown as NextRequest)

const params = { params: Promise.resolve({ id: 'sug1' }) }

describe('/api/super/suggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireSuperuser.mockResolvedValue({ id: 'super1', email: 'super@example.com' } as any)
    ;(prisma.suggestion.findMany as jest.Mock).mockResolvedValue([dbSuggestion])
    ;(prisma.suggestion.findUnique as jest.Mock).mockResolvedValue(dbSuggestion)
    ;(prisma.suggestion.update as jest.Mock).mockResolvedValue(dbSuggestion)
  })

  describe('GET', () => {
    it('returns 401 for non-superusers', async () => {
      mockedRequireSuperuser.mockRejectedValue(new Error('Superuser access required'))
      const res = await GET(makeGetReq())
      expect(res.status).toBe(401)
    })

    it('applies type and status filters', async () => {
      const res = await GET(makeGetReq('?type=FEATURE&status=PENDING'))
      expect(res.status).toBe(200)
      expect(prisma.suggestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'FEATURE', status: 'PENDING' }),
        })
      )
    })

    it('rejects an invalid type filter', async () => {
      const res = await GET(makeGetReq('?type=bogus'))
      expect(res.status).toBe(400)
    })
  })

  describe('PATCH [id]', () => {
    it('returns 401 for non-superusers', async () => {
      mockedRequireSuperuser.mockRejectedValue(new Error('Superuser access required'))
      const res = await PATCH(makePatchReq({ status: 'PLANNED' }), params)
      expect(res.status).toBe(401)
    })

    it('returns 404 for an unknown suggestion', async () => {
      ;(prisma.suggestion.findUnique as jest.Mock).mockResolvedValue(null)
      const res = await PATCH(makePatchReq({ status: 'PLANNED' }), params)
      expect(res.status).toBe(404)
    })

    it('rejects an empty update', async () => {
      const res = await PATCH(makePatchReq({}), params)
      expect(res.status).toBe(400)
    })

    it('updates status without touching response fields', async () => {
      const res = await PATCH(makePatchReq({ status: 'PLANNED' }), params)
      expect(res.status).toBe(200)
      expect(prisma.suggestion.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'PLANNED' } })
      )
    })

    it('records the responder and timestamp when a response is set', async () => {
      const res = await PATCH(makePatchReq({ status: 'DONE', response: 'Shipped!' }), params)
      expect(res.status).toBe(200)
      const updateArgs = (prisma.suggestion.update as jest.Mock).mock.calls[0][0]
      expect(updateArgs.data.status).toBe('DONE')
      expect(updateArgs.data.response).toBe('Shipped!')
      expect(updateArgs.data.respondedBy).toEqual({ connect: { id: 'super1' } })
      expect(updateArgs.data.respondedAt).toBeInstanceOf(Date)
    })
  })
})
