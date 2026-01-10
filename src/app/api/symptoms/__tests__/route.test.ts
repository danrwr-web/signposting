import { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'
import { getCachedEffectiveSymptoms } from '@/server/effectiveSymptoms'

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
  getCachedEffectiveSymptoms: jest.fn(),
}))

const mockedGetCachedEffectiveSymptoms = getCachedEffectiveSymptoms as jest.MockedFunction<typeof getCachedEffectiveSymptoms>

const createRequest = (url: string) => ({ url } as unknown as NextRequest)

describe('GET /api/symptoms', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('includes enabled local-only (custom) symptoms in results for a surgery', async () => {
    ;(prisma.surgery.findUnique as jest.Mock).mockImplementation(({ where }: any) => {
      if (where?.id === 'surgery-a') return Promise.resolve({ id: 'surgery-a' })
      return Promise.resolve(null)
    })

    mockedGetCachedEffectiveSymptoms.mockResolvedValueOnce([
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
})

