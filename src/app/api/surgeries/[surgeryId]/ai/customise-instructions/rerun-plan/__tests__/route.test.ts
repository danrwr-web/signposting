import { NextRequest } from 'next/server'
import { GET } from '../route'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { computeAiRerunPlan } from '@/server/aiRerunPlan'

jest.mock('@/lib/rbac', () => ({
  requireSuperuser: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    surgery: { findUnique: jest.fn() },
  },
}))

jest.mock('@/server/aiRerunPlan', () => ({
  computeAiRerunPlan: jest.fn(),
}))

const mockedRequireSuperuser = requireSuperuser as jest.MockedFunction<typeof requireSuperuser>
const mockedFindUnique = prisma.surgery.findUnique as jest.Mock
const mockedComputePlan = computeAiRerunPlan as jest.MockedFunction<typeof computeAiRerunPlan>

const request = {} as NextRequest
const params = (surgeryId: string) => ({ params: Promise.resolve({ surgeryId }) })

describe('GET /api/surgeries/[surgeryId]/ai/customise-instructions/rerun-plan', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects non-superusers', async () => {
    mockedRequireSuperuser.mockRejectedValueOnce(new Error('Superuser access required'))

    const response = await GET(request, params('surgery-1'))

    expect(response.status).toBe(401)
    expect(mockedComputePlan).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown surgery', async () => {
    mockedRequireSuperuser.mockResolvedValueOnce({} as any)
    mockedFindUnique.mockResolvedValueOnce(null)

    const response = await GET(request, params('missing'))

    expect(response.status).toBe(404)
  })

  it('returns the plan for superusers', async () => {
    mockedRequireSuperuser.mockResolvedValueOnce({} as any)
    mockedFindUnique.mockResolvedValueOnce({ id: 'surgery-1' })
    mockedComputePlan.mockResolvedValueOnce({
      items: [
        {
          id: 'base-1',
          name: 'Fever',
          ageGroup: 'U5',
          source: 'override',
          classification: 'human-edited',
          safeToRerun: false,
        },
      ],
      safeCount: 0,
      skippedCount: 1,
    })

    const response = await GET(request, params('surgery-1'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(mockedComputePlan).toHaveBeenCalledWith('surgery-1')
    expect(json.skippedCount).toBe(1)
    expect(json.items[0].classification).toBe('human-edited')
  })
})
