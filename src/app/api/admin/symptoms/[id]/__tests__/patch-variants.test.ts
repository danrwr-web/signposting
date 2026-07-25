import { NextRequest } from 'next/server'
import { PATCH } from '../route'
import { prisma } from '@/lib/prisma'
import { requireSuperuser, requireSurgeryAdmin } from '@/lib/rbac'

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}))

jest.mock('@/server/effectiveSymptoms', () => ({
  getCachedSymptomsTag: jest.fn(() => 'symptoms:tag'),
}))

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
  requireSuperuser: jest.fn(),
  requireSurgeryAdmin: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    baseSymptom: { update: jest.fn(), findUnique: jest.fn() },
    surgeryCustomSymptom: { update: jest.fn(), findFirst: jest.fn() },
    surgerySymptomOverride: { upsert: jest.fn(), findFirst: jest.fn() },
    surgerySymptomStatus: { upsert: jest.fn() },
  },
}))

const makeReq = (body: unknown) =>
  ({
    json: async () => body,
    url: 'http://localhost/api/admin/symptoms/base-1',
  }) as unknown as NextRequest

const call = (body: unknown) => PATCH(makeReq(body), { params: Promise.resolve({ id: 'base-1' }) })

const VALID_VARIANTS = {
  heading: 'By age',
  position: 'after',
  ageGroups: [{ key: 'U5', label: 'Under 5', instructions: '<p>See U5 advice</p>' }],
}

describe('PATCH /api/admin/symptoms/[id] variants handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.baseSymptom.update as jest.Mock).mockResolvedValue({ id: 'base-1' })
  })

  it('writes validated + sanitized variants on the base branch', async () => {
    const res = await call({ source: 'base', variants: VALID_VARIANTS })

    expect(res.status).toBe(200)
    expect(requireSuperuser).toHaveBeenCalled()
    const update = (prisma.baseSymptom.update as jest.Mock).mock.calls[0][0]
    expect(update.data.variants).toEqual(VALID_VARIANTS)
  })

  it('sanitizes script content out of variant instructions', async () => {
    const res = await call({
      source: 'base',
      variants: {
        ageGroups: [{ key: 'Adult', label: 'Adult', instructions: '<p>ok</p><script>alert(1)</script>' }],
      },
    })

    expect(res.status).toBe(200)
    const update = (prisma.baseSymptom.update as jest.Mock).mock.calls[0][0]
    expect(update.data.variants.ageGroups[0].instructions).toBe('<p>ok</p>')
  })

  it('clears variants when null is sent explicitly', async () => {
    const res = await call({ source: 'base', variants: null })

    expect(res.status).toBe(200)
    const update = (prisma.baseSymptom.update as jest.Mock).mock.calls[0][0]
    expect(update.data.variants).toBeNull()
  })

  it('leaves variants untouched when the key is absent', async () => {
    const res = await call({ source: 'base', name: 'Renamed' })

    expect(res.status).toBe(200)
    const update = (prisma.baseSymptom.update as jest.Mock).mock.calls[0][0]
    expect('variants' in update.data).toBe(false)
  })

  it('rejects an invalid variants shape with 400', async () => {
    const res = await call({ source: 'base', variants: { ageGroups: [] } })

    expect(res.status).toBe(400)
    expect(prisma.baseSymptom.update).not.toHaveBeenCalled()
  })

  it('ignores variants on the override branch', async () => {
    ;(prisma.baseSymptom.findUnique as jest.Mock).mockResolvedValue({ id: 'base-1' })
    ;(prisma.surgerySymptomOverride.upsert as jest.Mock).mockResolvedValue({ id: 'ov-1' })
    ;(prisma.surgerySymptomStatus.upsert as jest.Mock).mockResolvedValue({})

    const res = await call({
      source: 'override',
      surgeryId: 's1',
      name: 'Local name',
      variants: VALID_VARIANTS,
    })

    expect(res.status).toBe(200)
    expect(requireSurgeryAdmin).toHaveBeenCalledWith('s1')
    expect(prisma.baseSymptom.update).not.toHaveBeenCalled()
    const upsert = (prisma.surgerySymptomOverride.upsert as jest.Mock).mock.calls[0][0]
    expect(JSON.stringify(upsert)).not.toContain('ageGroups')
  })
})
