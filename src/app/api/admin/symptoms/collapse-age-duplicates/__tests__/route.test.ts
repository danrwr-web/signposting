import { NextRequest } from 'next/server'
import { POST } from '../route'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { computeCollapsePlan, executeCollapsePlan } from '@/server/collapseAgeDuplicates'
import { updateRequiresClinicalReview } from '@/server/updateRequiresClinicalReview'
import { revalidateTag } from 'next/cache'

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    surgery: { findUnique: jest.fn() },
  },
}))

jest.mock('@/server/collapseAgeDuplicates', () => ({
  computeCollapsePlan: jest.fn(),
  executeCollapsePlan: jest.fn(),
}))

jest.mock('@/server/updateRequiresClinicalReview', () => ({
  updateRequiresClinicalReview: jest.fn(),
}))

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}))

jest.mock('@/server/effectiveSymptoms', () => ({
  getCachedSymptomsTag: jest.fn((surgeryId: string, includeDisabled: boolean) =>
    `symptoms:${surgeryId}:${includeDisabled ? 'with-disabled' : 'enabled'}`
  ),
}))

const mockedGetSessionUser = getSessionUser as jest.Mock
const mockedFindUnique = prisma.surgery.findUnique as jest.Mock
const mockedComputePlan = computeCollapsePlan as jest.Mock
const mockedExecutePlan = executeCollapsePlan as jest.Mock
const mockedUpdateReview = updateRequiresClinicalReview as jest.Mock
const mockedRevalidateTag = revalidateTag as jest.Mock

const createRequest = (body: any) =>
  ({
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest)

const superuser = { globalRole: 'SUPERUSER', name: 'Super', email: 'super@example.com' }

const planWithDuplicates = {
  groups: [
    {
      name: 'Cough',
      kept: { baseSymptomId: 'adult', ageGroup: 'Adult', source: 'base' },
      disabled: [
        { baseSymptomId: 'u5', ageGroup: 'U5', source: 'base' },
        { baseSymptomId: 'o5', ageGroup: 'O5', source: 'base' },
      ],
      reason: 'age-preference',
    },
  ],
  counts: { duplicateGroups: 1, disabledCount: 2, keptCount: 1 },
  skippedCustomDuplicates: [],
}

describe('POST /api/admin/symptoms/collapse-age-duplicates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedFindUnique.mockResolvedValue({ id: 'surgery-1' })
    mockedComputePlan.mockResolvedValue(planWithDuplicates)
  })

  it('rejects unauthenticated requests', async () => {
    mockedGetSessionUser.mockResolvedValueOnce(null)
    const res = await POST(createRequest({ surgeryId: 'surgery-1', mode: 'preview' }))
    expect(res.status).toBe(401)
  })

  it('rejects non-superusers', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({ globalRole: 'ADMIN' })
    const res = await POST(createRequest({ surgeryId: 'surgery-1', mode: 'preview' }))
    expect(res.status).toBe(403)
  })

  it('rejects invalid bodies', async () => {
    mockedGetSessionUser.mockResolvedValueOnce(superuser)
    const res = await POST(createRequest({ surgeryId: 'surgery-1', mode: 'apply' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown surgeries', async () => {
    mockedGetSessionUser.mockResolvedValueOnce(superuser)
    mockedFindUnique.mockResolvedValueOnce(null)
    const res = await POST(createRequest({ surgeryId: 'nope', mode: 'preview' }))
    expect(res.status).toBe(404)
  })

  it('preview returns the plan without writing anything', async () => {
    mockedGetSessionUser.mockResolvedValueOnce(superuser)
    const res = await POST(createRequest({ surgeryId: 'surgery-1', mode: 'preview' }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.mode).toBe('preview')
    expect(json.counts.disabledCount).toBe(2)
    expect(mockedExecutePlan).not.toHaveBeenCalled()
    expect(mockedUpdateReview).not.toHaveBeenCalled()
    expect(mockedRevalidateTag).not.toHaveBeenCalled()
  })

  it('execute applies the plan, updates review flag and revalidates caches', async () => {
    mockedGetSessionUser.mockResolvedValueOnce(superuser)
    const res = await POST(createRequest({ surgeryId: 'surgery-1', mode: 'execute' }))

    expect(res.status).toBe(200)
    expect(mockedExecutePlan).toHaveBeenCalledWith('surgery-1', planWithDuplicates, 'Super')
    expect(mockedUpdateReview).toHaveBeenCalledWith('surgery-1')
    expect(mockedRevalidateTag).toHaveBeenCalledWith('symptoms:surgery-1:enabled')
    expect(mockedRevalidateTag).toHaveBeenCalledWith('symptoms:surgery-1:with-disabled')
    expect(mockedRevalidateTag).toHaveBeenCalledWith('symptoms')
  })

  it('execute with nothing to disable performs no writes', async () => {
    mockedGetSessionUser.mockResolvedValueOnce(superuser)
    mockedComputePlan.mockResolvedValueOnce({
      groups: [],
      counts: { duplicateGroups: 0, disabledCount: 0, keptCount: 0 },
      skippedCustomDuplicates: [],
    })
    const res = await POST(createRequest({ surgeryId: 'surgery-1', mode: 'execute' }))

    expect(res.status).toBe(200)
    expect(mockedExecutePlan).not.toHaveBeenCalled()
    expect(mockedRevalidateTag).not.toHaveBeenCalled()
  })
})
