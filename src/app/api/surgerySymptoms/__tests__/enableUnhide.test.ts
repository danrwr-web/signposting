import { NextRequest } from 'next/server'
import { PATCH } from '../route'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { updateRequiresClinicalReview } from '@/server/updateRequiresClinicalReview'

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
}))

jest.mock('@/server/effectiveSymptoms', () => ({
  getEffectiveSymptoms: jest.fn(),
  getCachedSymptomsTag: jest.fn(() => 'tag'),
}))

jest.mock('@/server/updateRequiresClinicalReview', () => ({
  updateRequiresClinicalReview: jest.fn(),
}))

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    surgery: { findUnique: jest.fn() },
    surgerySymptomStatus: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    surgerySymptomOverride: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

const mockedGetSessionUser = getSessionUser as jest.MockedFunction<typeof getSessionUser>

const makeReq = (body: Record<string, unknown>) =>
  ({ json: async () => body } as unknown as NextRequest)

describe('PATCH /api/surgerySymptoms enable actions unhide override-hidden symptoms', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetSessionUser.mockResolvedValue({
      globalRole: 'SUPERUSER',
      name: 'Super',
      email: 'super@example.com',
      memberships: [],
    } as any)
    ;(prisma.surgery.findUnique as jest.Mock).mockResolvedValue({ id: 's1' })
    ;(prisma.surgerySymptomOverride.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
  })

  it('ENABLE_BASE clears isHidden on the override', async () => {
    ;(prisma.surgerySymptomStatus.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.surgerySymptomStatus.create as jest.Mock).mockResolvedValue({ id: 'st1' })

    const res = await PATCH(makeReq({ action: 'ENABLE_BASE', surgeryId: 's1', baseSymptomId: 'base-1' }))

    expect(res.status).toBe(200)
    expect(prisma.surgerySymptomOverride.updateMany).toHaveBeenCalledWith({
      where: { surgeryId: 's1', baseSymptomId: 'base-1', isHidden: true },
      data: { isHidden: false },
    })
    // The newly visible symptom may be implicitly pending review.
    expect(updateRequiresClinicalReview).toHaveBeenCalledWith('s1')
  })

  it('ENABLE_EXISTING via statusRowId clears isHidden for the row\'s base symptom', async () => {
    ;(prisma.surgerySymptomStatus.findUnique as jest.Mock).mockResolvedValue({ surgeryId: 's1' })
    ;(prisma.surgerySymptomStatus.update as jest.Mock).mockResolvedValue({
      surgeryId: 's1',
      baseSymptomId: 'base-1',
    })

    const res = await PATCH(makeReq({ action: 'ENABLE_EXISTING', statusRowId: 'st1' }))

    expect(res.status).toBe(200)
    expect(prisma.surgerySymptomOverride.updateMany).toHaveBeenCalledWith({
      where: { surgeryId: 's1', baseSymptomId: 'base-1', isHidden: true },
      data: { isHidden: false },
    })
  })

  it('ENABLE_EXISTING via baseSymptomId clears isHidden', async () => {
    ;(prisma.surgerySymptomStatus.findFirst as jest.Mock).mockResolvedValue({ id: 'st1' })
    ;(prisma.surgerySymptomStatus.update as jest.Mock).mockResolvedValue({
      surgeryId: 's1',
      baseSymptomId: 'base-1',
    })

    const res = await PATCH(makeReq({ action: 'ENABLE_EXISTING', surgeryId: 's1', baseSymptomId: 'base-1' }))

    expect(res.status).toBe(200)
    expect(prisma.surgerySymptomOverride.updateMany).toHaveBeenCalledWith({
      where: { surgeryId: 's1', baseSymptomId: 'base-1', isHidden: true },
      data: { isHidden: false },
    })
  })

  it('ENABLE_EXISTING for a custom symptom does not touch overrides', async () => {
    ;(prisma.surgerySymptomStatus.findFirst as jest.Mock).mockResolvedValue({ id: 'st1' })
    ;(prisma.surgerySymptomStatus.update as jest.Mock).mockResolvedValue({
      surgeryId: 's1',
      baseSymptomId: null,
    })

    const res = await PATCH(makeReq({ action: 'ENABLE_EXISTING', surgeryId: 's1', customSymptomId: 'cust-1' }))

    expect(res.status).toBe(200)
    expect(prisma.surgerySymptomOverride.updateMany).not.toHaveBeenCalled()
  })
})
