import { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'

jest.mock('@/lib/test-user-limits', () => ({
  checkTestUserUsageLimit: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    surgery: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    baseSymptom: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/server/effectiveSymptoms', () => ({
  getEffectiveSymptoms: jest.fn(),
}))

const mockedGetEffectiveSymptoms = getEffectiveSymptoms as jest.MockedFunction<typeof getEffectiveSymptoms>

const createRequest = (url: string) => ({ url } as unknown as NextRequest)

describe('GET /api/symptoms', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.surgery.findUnique as jest.Mock).mockImplementation(({ where }: any) => {
      if (where?.id === 'surgery-a') return Promise.resolve({ id: 'surgery-a' })
      return Promise.resolve(null)
    })
  })

  it('includes enabled local-only (custom) symptoms in results for a surgery', async () => {
    mockedGetEffectiveSymptoms.mockResolvedValueOnce([
      {
        id: 'custom-1',
        slug: 'local-only',
        name: 'Local-only symptom',
        ageGroup: 'Adult',
        briefInstruction: null,
        highlightedText: null,
        instructions: null,
        instructionsJson: null,
        instructionsHtml: null,
        linkToPage: null,
        source: 'custom',
      },
    ] as any)

    const res = await GET(createRequest('http://localhost/api/symptoms?surgery=surgery-a'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.symptoms)).toBe(true)
    expect(json.symptoms.some((s: any) => s.id === 'custom-1' && s.source === 'custom')).toBe(true)
  })

  it('searches the displayed override HTML, not the stale legacy base markdown', async () => {
    const overriddenSymptom = {
      id: 'base-1',
      slug: 'chest-pain',
      name: 'Chest Pain',
      ageGroup: 'Adult',
      briefInstruction: 'Route urgently',
      highlightedText: null,
      // Effective `instructions` falls back to the BASE legacy markdown because
      // overrides never write that field — it can describe content the surgery
      // no longer uses.
      instructions: 'Possible cardiac event, monitor at home',
      instructionsJson: null,
      instructionsHtml: '<p>Route to <strong>A&amp;E via ambulance</strong></p>',
      linkToPage: null,
      source: 'override',
      baseSymptomId: 'base-1',
    }

    mockedGetEffectiveSymptoms.mockResolvedValue([overriddenSymptom] as any)

    // A term only present in the displayed override HTML matches
    let res = await GET(createRequest('http://localhost/api/symptoms?surgery=surgery-a&q=ambulance'))
    let json = await res.json()
    expect(json.symptoms.map((s: any) => s.id)).toEqual(['base-1'])

    // A term only present in the stale base markdown does NOT match
    res = await GET(createRequest('http://localhost/api/symptoms?surgery=surgery-a&q=cardiac'))
    json = await res.json()
    expect(json.symptoms).toEqual([])
  })

  it('falls back to legacy markdown for symptoms with no HTML content', async () => {
    mockedGetEffectiveSymptoms.mockResolvedValueOnce([
      {
        id: 'base-2',
        slug: 'fever',
        name: 'Fever',
        ageGroup: 'U5',
        briefInstruction: null,
        highlightedText: null,
        instructions: 'Possible viral infection, monitor temperature',
        instructionsJson: null,
        instructionsHtml: null,
        linkToPage: null,
        source: 'base',
      },
    ] as any)

    const res = await GET(createRequest('http://localhost/api/symptoms?surgery=surgery-a&q=viral'))
    const json = await res.json()
    expect(json.symptoms.map((s: any) => s.id)).toEqual(['base-2'])
  })
})
