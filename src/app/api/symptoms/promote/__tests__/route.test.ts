/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { getEffectiveSymptomById } from '@/server/effectiveSymptoms'
import { generateUniqueSymptomSlug } from '@/server/symptomSlug'

jest.mock('next/cache', () => ({ revalidateTag: jest.fn() }))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    surgeryCustomSymptom: { findFirst: jest.fn() },
    baseSymptom: { findFirst: jest.fn() },
    surgerySymptomOverride: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/rbac', () => ({ getSessionUser: jest.fn() }))

jest.mock('@/server/effectiveSymptoms', () => ({
  getCachedSymptomsTag: (sid: string, d: boolean) => `symptoms:${sid}:${d}`,
  getEffectiveSymptomById: jest.fn(),
  resolveLinkToPages: (row: { linkToPages?: unknown; linkToPage?: string | null }) => {
    if (Array.isArray(row.linkToPages)) return row.linkToPages as string[]
    return row.linkToPage ? [row.linkToPage] : null
  },
}))

jest.mock('@/server/symptomSlug', () => ({ generateUniqueSymptomSlug: jest.fn() }))

const mockedSession = getSessionUser as jest.MockedFunction<typeof getSessionUser>
const mockedEffective = getEffectiveSymptomById as jest.MockedFunction<typeof getEffectiveSymptomById>
const mockedSlug = generateUniqueSymptomSlug as jest.MockedFunction<typeof generateUniqueSymptomSlug>

const makeReq = (body: unknown): NextRequest =>
  ({ json: async () => body }) as unknown as NextRequest

// Transaction client whose calls we can inspect.
const tx = {
  baseSymptom: { create: jest.fn(), update: jest.fn() },
  surgerySymptomStatus: { updateMany: jest.fn(), create: jest.fn() },
  surgeryCustomSymptom: { update: jest.fn() },
  surgerySymptomOverride: { deleteMany: jest.fn() },
  symptomHistory: { create: jest.fn() },
}

const CUSTOM_ID = 'cjld2cjxh0000qzrmn831i7rn'

describe('POST /api/symptoms/promote', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedSession.mockResolvedValue({ globalRole: 'SUPERUSER', name: 'Super', email: 'su@nhs.uk' } as any)
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(tx))
    tx.baseSymptom.create.mockResolvedValue({ id: 'base-new' })
    tx.surgerySymptomStatus.updateMany.mockResolvedValue({ count: 1 })
    mockedSlug.mockResolvedValue('sore-throat')
  })

  it('rejects non-superusers', async () => {
    mockedSession.mockResolvedValue({ globalRole: 'ADMIN' } as any)
    const res = await POST(makeReq({ customSymptomId: CUSTOM_ID }))
    expect(res.status).toBe(403)
  })

  it('rejects a body with both or neither target', async () => {
    expect((await POST(makeReq({}))).status).toBe(400)
    expect(
      (await POST(makeReq({ customSymptomId: CUSTOM_ID, baseSymptomId: 'b1', surgeryId: 's1' }))).status
    ).toBe(400)
    expect((await POST(makeReq({ baseSymptomId: 'b1' }))).status).toBe(400)
  })

  describe('custom symptom → new base symptom', () => {
    const custom = {
      id: CUSTOM_ID,
      surgeryId: 'sur-1',
      name: 'Sore throat',
      ageGroup: 'Adult',
      briefInstruction: 'Brief',
      instructions: '<p>Hi</p>',
      instructionsHtml: '<p>Hi</p>',
      instructionsJson: null,
      highlightedText: null,
      linkToPage: null,
      linkToPages: ['Coughs'],
      variants: null,
    }

    it('404s when the custom symptom does not exist', async () => {
      ;(prisma.surgeryCustomSymptom.findFirst as jest.Mock).mockResolvedValue(null)
      const res = await POST(makeReq({ customSymptomId: CUSTOM_ID }))
      expect(res.status).toBe(404)
    })

    it('creates an opt-in base symptom, keeps the practice enabled, retires the custom copy', async () => {
      ;(prisma.surgeryCustomSymptom.findFirst as jest.Mock).mockResolvedValue(custom)
      const res = await POST(makeReq({ customSymptomId: CUSTOM_ID }))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true, baseSymptomId: 'base-new', created: true })

      expect(mockedSlug).toHaveBeenCalledWith('Sore throat', { scope: 'BASE' })
      const createData = tx.baseSymptom.create.mock.calls[0][0].data
      expect(createData).toMatchObject({
        name: 'Sore throat',
        slug: 'sore-throat',
        enabledByDefault: false,
        linkToPage: 'Coughs',
        linkToPages: ['Coughs'],
      })

      // Practice's status row repointed at the new base, still enabled.
      expect(tx.surgerySymptomStatus.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { surgeryId: 'sur-1', customSymptomId: CUSTOM_ID },
          data: expect.objectContaining({ customSymptomId: null, baseSymptomId: 'base-new', isEnabled: true }),
        })
      )
      // No extra row when the repoint matched one.
      expect(tx.surgerySymptomStatus.create).not.toHaveBeenCalled()

      expect(tx.surgeryCustomSymptom.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: CUSTOM_ID }, data: { isDeleted: true } })
      )
      expect(tx.symptomHistory.create).toHaveBeenCalled()
    })

    it('creates an enabled status row when the practice had none', async () => {
      ;(prisma.surgeryCustomSymptom.findFirst as jest.Mock).mockResolvedValue(custom)
      tx.surgerySymptomStatus.updateMany.mockResolvedValue({ count: 0 })
      const res = await POST(makeReq({ customSymptomId: CUSTOM_ID }))
      expect(res.status).toBe(200)
      expect(tx.surgerySymptomStatus.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ surgeryId: 'sur-1', baseSymptomId: 'base-new', isEnabled: true }),
        })
      )
    })
  })

  describe('override → update existing base symptom', () => {
    beforeEach(() => {
      ;(prisma.baseSymptom.findFirst as jest.Mock).mockResolvedValue({
        id: 'base-1',
        briefInstruction: 'Old brief',
        instructionsHtml: '<p>Old</p>',
        highlightedText: null,
      })
      ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValue({ id: 'ovr-1' })
      mockedEffective.mockResolvedValue({
        id: 'base-1',
        name: 'Practice name',
        ageGroup: 'Adult',
        briefInstruction: 'New brief',
        highlightedText: 'Notice',
        instructions: '<p>New</p>',
        instructionsHtml: '<p>New</p>',
        linkToPages: ['Chest pain'],
        variants: null,
        source: 'override',
      } as any)
    })

    it('400s when the practice has no override', async () => {
      ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValue(null)
      const res = await POST(makeReq({ baseSymptomId: 'base-1', surgeryId: 'sur-1' }))
      expect(res.status).toBe(400)
    })

    it('writes the effective practice content to base and removes the override', async () => {
      const res = await POST(makeReq({ baseSymptomId: 'base-1', surgeryId: 'sur-1' }))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true, baseSymptomId: 'base-1', created: false })

      const updateData = tx.baseSymptom.update.mock.calls[0][0].data
      expect(updateData).toMatchObject({
        name: 'Practice name',
        briefInstruction: 'New brief',
        instructionsHtml: '<p>New</p>',
        highlightedText: 'Notice',
        linkToPage: 'Chest pain',
        linkToPages: ['Chest pain'],
      })

      expect(tx.surgerySymptomOverride.deleteMany).toHaveBeenCalledWith({
        where: { surgeryId: 'sur-1', baseSymptomId: 'base-1' },
      })
      const history = tx.symptomHistory.create.mock.calls[0][0].data
      expect(history).toMatchObject({
        symptomId: 'base-1',
        source: 'base',
        previousInstructionsHtml: '<p>Old</p>',
        newInstructionsHtml: '<p>New</p>',
      })
    })

    it('400s when the practice version is hidden', async () => {
      mockedEffective.mockResolvedValue(null)
      const res = await POST(makeReq({ baseSymptomId: 'base-1', surgeryId: 'sur-1' }))
      expect(res.status).toBe(400)
    })
  })
})
