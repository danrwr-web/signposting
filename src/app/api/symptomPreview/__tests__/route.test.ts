import { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    surgery: { findUnique: jest.fn() },
    baseSymptom: { findFirst: jest.fn() },
    surgeryCustomSymptom: { findFirst: jest.fn() },
    surgerySymptomOverride: { findUnique: jest.fn() },
    surgerySymptomStatus: { findFirst: jest.fn() },
  },
}))

const mockedGetSessionUser = getSessionUser as jest.MockedFunction<typeof getSessionUser>

const makeReq = (query: string) =>
  ({ url: `http://localhost/api/symptomPreview?${query}` } as unknown as NextRequest)

const baseSymptomRow = {
  id: 'base-1',
  name: 'Contraception (Routine)',
  briefInstruction: 'Brief',
  instructionsHtml: '<p>Full</p>',
  highlightedText: null,
}

describe('GET /api/symptomPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetSessionUser.mockResolvedValue({
      globalRole: 'SUPERUSER',
      memberships: [],
    } as any)
    ;(prisma.surgery.findUnique as jest.Mock).mockResolvedValue({ id: 's1' })
    ;(prisma.baseSymptom.findFirst as jest.Mock).mockResolvedValue(baseSymptomRow)
    ;(prisma.surgeryCustomSymptom.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.surgerySymptomStatus.findFirst as jest.Mock).mockResolvedValue(null)
  })

  it('reports a never-toggled base symptom as enabled (no status row)', async () => {
    const res = await GET(makeReq('surgeryId=s1&baseSymptomId=base-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.isEnabled).toBe(true)
    expect(json.status).toBe('BASE')
  })

  it('reports a base symptom with an explicitly disabled status row as not enabled', async () => {
    ;(prisma.surgerySymptomStatus.findFirst as jest.Mock).mockResolvedValue({
      id: 'st1',
      isEnabled: false,
      lastEditedBy: 'Alice',
      lastEditedAt: new Date('2026-01-01'),
    })

    const res = await GET(makeReq('surgeryId=s1&baseSymptomId=base-1'))
    const json = await res.json()

    expect(json.isEnabled).toBe(false)
  })

  it('reports an override-hidden base symptom as not enabled even with an enabled status row', async () => {
    ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValue({
      briefInstruction: null,
      instructionsHtml: null,
      highlightedText: null,
      isHidden: true,
      lastEditedBy: null,
      lastEditedAt: null,
    })
    ;(prisma.surgerySymptomStatus.findFirst as jest.Mock).mockResolvedValue({
      id: 'st1',
      isEnabled: true,
      lastEditedBy: null,
      lastEditedAt: null,
    })

    const res = await GET(makeReq('surgeryId=s1&baseSymptomId=base-1'))
    const json = await res.json()

    expect(json.isEnabled).toBe(false)
  })

  it('reports a never-toggled custom symptom as enabled', async () => {
    ;(prisma.surgeryCustomSymptom.findFirst as jest.Mock).mockResolvedValue({
      id: 'cust-1',
      name: 'Local symptom',
      briefInstruction: null,
      instructionsHtml: null,
      highlightedText: null,
      lastEditedBy: null,
      lastEditedAt: null,
    })

    const res = await GET(makeReq('surgeryId=s1&customSymptomId=cust-1'))
    const json = await res.json()

    expect(json.isEnabled).toBe(true)
    expect(json.status).toBe('LOCAL_ONLY')
  })

  it('uses the most recent edit across status row and override for "Last changed"', async () => {
    ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValue({
      briefInstruction: 'Local brief',
      instructionsHtml: '<p>Local</p>',
      highlightedText: null,
      isHidden: false,
      lastEditedBy: 'Bob',
      lastEditedAt: new Date('2026-06-01T00:00:00Z'),
    })
    ;(prisma.surgerySymptomStatus.findFirst as jest.Mock).mockResolvedValue({
      id: 'st1',
      isEnabled: true,
      lastEditedBy: 'Alice',
      lastEditedAt: new Date('2026-01-01T00:00:00Z'),
    })

    const res = await GET(makeReq('surgeryId=s1&baseSymptomId=base-1'))
    const json = await res.json()

    expect(json.lastEditedBy).toBe('Bob')
    expect(json.lastEditedAt).toBe('2026-06-01T00:00:00.000Z')
  })

  it('falls back to override edit info when there is no status row', async () => {
    ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValue({
      briefInstruction: 'Local brief',
      instructionsHtml: '<p>Local</p>',
      highlightedText: null,
      isHidden: false,
      lastEditedBy: 'Emily Horlock',
      lastEditedAt: new Date('2026-07-02T00:00:00Z'),
    })

    const res = await GET(makeReq('surgeryId=s1&baseSymptomId=base-1'))
    const json = await res.json()

    expect(json.status).toBe('MODIFIED')
    expect(json.isEnabled).toBe(true)
    expect(json.lastEditedBy).toBe('Emily Horlock')
    expect(json.lastEditedAt).toBe('2026-07-02T00:00:00.000Z')
  })

  const VARIANTS = {
    heading: 'By age',
    position: 'after',
    ageGroups: [{ key: 'u5', label: 'Under 5', instructions: '<p>U5 advice</p>' }],
  }

  it('returns base symptom variants', async () => {
    ;(prisma.baseSymptom.findFirst as jest.Mock).mockResolvedValue({ ...baseSymptomRow, variants: VARIANTS })

    const json = await (await GET(makeReq('surgeryId=s1&baseSymptomId=base-1'))).json()

    expect(json.variants).toEqual(VARIANTS)
  })

  it('returns BASE variants for an overridden symptom that has none of its own', async () => {
    ;(prisma.baseSymptom.findFirst as jest.Mock).mockResolvedValue({ ...baseSymptomRow, variants: VARIANTS })
    ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValue({
      briefInstruction: null,
      instructionsHtml: '<p>Local</p>',
      highlightedText: null,
      isHidden: false,
      lastEditedBy: null,
      lastEditedAt: null,
      variants: null,
    })

    const json = await (await GET(makeReq('surgeryId=s1&baseSymptomId=base-1'))).json()

    expect(json.status).toBe('MODIFIED')
    expect(json.variants).toEqual(VARIANTS)
  })

  it('returns the surgery-level variants when the override carries its own', async () => {
    const surgeryVariants = { ageGroups: [{ key: 'adult', label: 'Local Adult', instructions: '<p>Local</p>' }] }
    ;(prisma.baseSymptom.findFirst as jest.Mock).mockResolvedValue({ ...baseSymptomRow, variants: VARIANTS })
    ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValue({
      briefInstruction: null,
      instructionsHtml: '<p>Local</p>',
      highlightedText: null,
      isHidden: false,
      lastEditedBy: null,
      lastEditedAt: null,
      variants: surgeryVariants,
    })

    const json = await (await GET(makeReq('surgeryId=s1&baseSymptomId=base-1'))).json()

    expect(json.variants).toEqual(surgeryVariants)
    // Base variants ride along so the drawers' "Base wording" toggle can show
    // the shared advice instead of the practice's.
    expect(json.baseVariants).toEqual(VARIANTS)
  })

  it('returns null baseVariants when the symptom is not overridden', async () => {
    ;(prisma.baseSymptom.findFirst as jest.Mock).mockResolvedValue({ ...baseSymptomRow, variants: VARIANTS })

    const json = await (await GET(makeReq('surgeryId=s1&baseSymptomId=base-1'))).json()

    expect(json.status).toBe('BASE')
    expect(json.baseVariants).toBeNull()
  })

  it('returns a custom symptom\'s own variants (null when it has none)', async () => {
    const customRow = {
      id: 'c1',
      name: 'Local Thing',
      briefInstruction: null,
      instructionsHtml: '<p>Custom</p>',
      highlightedText: null,
      lastEditedBy: null,
      lastEditedAt: null,
      variants: null,
    }
    ;(prisma.surgeryCustomSymptom.findFirst as jest.Mock).mockResolvedValue(customRow)
    let json = await (await GET(makeReq('surgeryId=s1&customSymptomId=c1'))).json()
    expect(json.status).toBe('LOCAL_ONLY')
    expect(json.variants).toBeNull()

    ;(prisma.surgeryCustomSymptom.findFirst as jest.Mock).mockResolvedValue({ ...customRow, variants: VARIANTS })
    json = await (await GET(makeReq('surgeryId=s1&customSymptomId=c1'))).json()
    expect(json.variants).toEqual(VARIANTS)
  })
})
