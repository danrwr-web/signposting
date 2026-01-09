import { NextRequest } from 'next/server'
import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { revalidateTag } from 'next/cache'

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}))

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
  requireSurgeryAdmin: jest.fn(),
  requireSuperuser: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    surgery: { findUnique: jest.fn() },
    surgeryCustomSymptom: { findFirst: jest.fn() },
    baseSymptom: { findFirst: jest.fn() },
    highRiskLink: { findUnique: jest.fn(), create: jest.fn() },
    defaultHighRiskButtonConfig: { findMany: jest.fn() },
  },
}))

const mockedGetSessionUser = getSessionUser as jest.MockedFunction<typeof getSessionUser>
const mockedRevalidateTag = revalidateTag as jest.MockedFunction<typeof revalidateTag>

const makeReq = (url: string, body: any) =>
  ({
    url,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest)

describe('POST /api/admin/highrisk cache invalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('revalidates highrisk tags after creating a link', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({
      globalRole: 'SUPERUSER',
      email: 'super@example.com',
      name: 'Super',
    } as any)

    ;(prisma.surgery.findUnique as jest.Mock).mockResolvedValueOnce({ id: 's1' })
    ;(prisma.surgeryCustomSymptom.findFirst as jest.Mock).mockResolvedValueOnce(null)
    ;(prisma.baseSymptom.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'sym1', slug: 'stroke', name: 'Stroke' })
    ;(prisma.highRiskLink.findUnique as jest.Mock).mockResolvedValueOnce(null)
    ;(prisma.highRiskLink.create as jest.Mock).mockResolvedValueOnce({
      id: 'hr1',
      label: 'Stroke',
      symptomSlug: 'stroke',
      symptomId: 'sym1',
      orderIndex: 0,
    })

    const res = await POST(
      makeReq('http://localhost/api/admin/highrisk?surgery=sluggy', { symptomId: 'sym1', orderIndex: 0 }),
    )

    expect(res.status).toBe(201)
    expect(mockedRevalidateTag).toHaveBeenCalledWith('highrisk')
    expect(mockedRevalidateTag).toHaveBeenCalledWith('highrisk:s1')
  })
})

