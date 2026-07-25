import { NextRequest } from 'next/server'
import { PATCH } from '../route'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
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

  it('clears variants with DbNull when null is sent explicitly', async () => {
    const res = await call({ source: 'base', variants: null })

    expect(res.status).toBe(200)
    const update = (prisma.baseSymptom.update as jest.Mock).mock.calls[0][0]
    expect(update.data.variants).toBe(Prisma.DbNull)
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

  describe('custom branch (practice-owned variants)', () => {
    beforeEach(() => {
      ;(prisma.surgeryCustomSymptom.update as jest.Mock).mockResolvedValue({ id: 'custom-1' })
    })

    const customCall = (variantsField: Record<string, unknown>) =>
      call({ source: 'custom', surgeryId: 's1', ...variantsField })

    it('writes validated + sanitized variants on the custom symptom', async () => {
      const res = await customCall({
        variants: {
          ageGroups: [{ key: 'u5', label: 'Under 5', instructions: '<p>ok</p><script>x()</script>' }],
        },
      })

      expect(res.status).toBe(200)
      expect(requireSurgeryAdmin).toHaveBeenCalledWith('s1')
      const update = (prisma.surgeryCustomSymptom.update as jest.Mock).mock.calls[0][0]
      expect(update.data.variants.ageGroups[0].instructions).toBe('<p>ok</p>')
    })

    it('clears with DbNull and rejects invalid shapes', async () => {
      const cleared = await customCall({ variants: null })
      expect(cleared.status).toBe(200)
      const update = (prisma.surgeryCustomSymptom.update as jest.Mock).mock.calls[0][0]
      expect(update.data.variants).toBe(Prisma.DbNull)

      const invalid = await customCall({ variants: { ageGroups: [] } })
      expect(invalid.status).toBe(400)
    })

    it('leaves variants untouched when the key is absent', async () => {
      const res = await customCall({ name: 'Renamed' })

      expect(res.status).toBe(200)
      const update = (prisma.surgeryCustomSymptom.update as jest.Mock).mock.calls[0][0]
      expect('variants' in update.data).toBe(false)
    })
  })

  describe('override branch (per-surgery variants)', () => {
    beforeEach(() => {
      ;(prisma.baseSymptom.findUnique as jest.Mock).mockResolvedValue({ id: 'base-1' })
      ;(prisma.surgerySymptomOverride.upsert as jest.Mock).mockResolvedValue({ id: 'ov-1' })
      ;(prisma.surgerySymptomStatus.upsert as jest.Mock).mockResolvedValue({})
    })

    const overrideCall = (variantsField: Record<string, unknown>) =>
      call({ source: 'override', surgeryId: 's1', name: 'Local name', ...variantsField })

    it('writes surgery-level variants when provided', async () => {
      const res = await overrideCall({ variants: VALID_VARIANTS })

      expect(res.status).toBe(200)
      expect(requireSurgeryAdmin).toHaveBeenCalledWith('s1')
      expect(prisma.baseSymptom.update).not.toHaveBeenCalled()
      const upsert = (prisma.surgerySymptomOverride.upsert as jest.Mock).mock.calls[0][0]
      expect(upsert.update.variants).toEqual(VALID_VARIANTS)
      expect(upsert.create.variants).toEqual(VALID_VARIANTS)
    })

    it('accepts empty ageGroups as "hide variants for this surgery"', async () => {
      const res = await overrideCall({ variants: { ageGroups: [] } })

      expect(res.status).toBe(200)
      const upsert = (prisma.surgerySymptomOverride.upsert as jest.Mock).mock.calls[0][0]
      expect(upsert.update.variants).toEqual({ ageGroups: [] })
    })

    it('clears the surgery-level variants with DbNull when null is sent (inherit base)', async () => {
      const res = await overrideCall({ variants: null })

      expect(res.status).toBe(200)
      const upsert = (prisma.surgerySymptomOverride.upsert as jest.Mock).mock.calls[0][0]
      expect(upsert.update.variants).toBe(Prisma.DbNull)
    })

    it('leaves variants untouched when the key is absent', async () => {
      const res = await overrideCall({})

      expect(res.status).toBe(200)
      const upsert = (prisma.surgerySymptomOverride.upsert as jest.Mock).mock.calls[0][0]
      expect('variants' in upsert.update).toBe(false)
    })
  })
})
