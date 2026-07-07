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
})
