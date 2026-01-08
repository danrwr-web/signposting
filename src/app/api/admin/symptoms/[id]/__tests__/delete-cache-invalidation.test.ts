import { NextRequest } from 'next/server'
import { DELETE } from '../route'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { revalidateTag } from 'next/cache'
import { getCachedSymptomsTag } from '@/server/effectiveSymptoms'

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}))

jest.mock('@/server/effectiveSymptoms', () => ({
  getCachedSymptomsTag: jest.fn((surgeryId: string, includeDisabled: boolean) => `symptoms:${surgeryId}:${includeDisabled ? 'with-disabled' : 'enabled'}`),
}))

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
  requireSuperuser: jest.fn(),
  requireSurgeryAdmin: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    surgerySymptomStatus: { deleteMany: jest.fn() },
    surgeryCustomSymptom: { update: jest.fn() },
    surgerySymptomOverride: { deleteMany: jest.fn(), upsert: jest.fn(), delete: jest.fn() },
    baseSymptom: { delete: jest.fn() },
  },
}))

const mockedGetSessionUser = getSessionUser as jest.MockedFunction<typeof getSessionUser>

const makeReq = (url: string) => ({ url } as unknown as NextRequest)

describe('DELETE /api/admin/symptoms/[id] cache invalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('revalidates surgery effective symptoms tag when deleting a custom symptom', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({
      globalRole: 'USER',
      memberships: [{ surgeryId: 's1', role: 'ADMIN' }],
    } as any)

    ;(prisma.$transaction as jest.Mock).mockResolvedValueOnce([])

    const res = await DELETE(makeReq('http://localhost/api/admin/symptoms/custom-1?source=custom&surgeryId=s1'), {
      params: Promise.resolve({ id: 'custom-1' }),
    })

    expect(res.status).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(getCachedSymptomsTag).toHaveBeenCalledWith('s1', false)
    expect(revalidateTag).toHaveBeenCalledWith('symptoms:s1:enabled')
    expect(revalidateTag).toHaveBeenCalledWith('symptoms')
  })
})

