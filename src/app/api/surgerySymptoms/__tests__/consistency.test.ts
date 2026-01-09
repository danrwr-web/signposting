import { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
}))

jest.mock('@/server/effectiveSymptoms', () => ({
  getEffectiveSymptoms: jest.fn(),
  getCachedSymptomsTag: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    surgery: { findUnique: jest.fn() },
    baseSymptom: { findMany: jest.fn() },
    surgeryCustomSymptom: { findMany: jest.fn() },
    surgerySymptomStatus: { findMany: jest.fn() },
    surgerySymptomOverride: { findMany: jest.fn() },
  },
}))

const mockedGetSessionUser = getSessionUser as jest.MockedFunction<typeof getSessionUser>
const mockedGetEffectiveSymptoms = getEffectiveSymptoms as jest.MockedFunction<typeof getEffectiveSymptoms>

const makeReq = (url: string) => ({ url } as unknown as NextRequest)

describe('GET /api/surgerySymptoms consistency with effectiveSymptoms', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('marks inUse items enabled/disabled based on getEffectiveSymptoms', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({
      globalRole: 'SUPERUSER',
      memberships: [],
    } as any)

    ;(prisma.surgery.findUnique as jest.Mock).mockResolvedValueOnce({ id: 's1' })

    // Available/hidden list inputs (not relevant to this test)
    ;(prisma.baseSymptom.findMany as jest.Mock).mockResolvedValueOnce([])
    ;(prisma.surgeryCustomSymptom.findMany as jest.Mock).mockResolvedValueOnce([])
    ;(prisma.surgerySymptomStatus.findMany as jest.Mock).mockResolvedValueOnce([])
    ;(prisma.surgerySymptomOverride.findMany as jest.Mock).mockResolvedValueOnce([])

    // includeDisabled=true returns 2 symptoms; includeDisabled=false returns 1 symptom
    mockedGetEffectiveSymptoms.mockImplementation(async (_surgeryId: string, includeDisabled: boolean) => {
      if (includeDisabled) {
        return [
          { id: 'a', name: 'A', source: 'base', ageGroup: 'Adult' },
          { id: 'b', name: 'B', source: 'base', ageGroup: 'Adult' },
        ] as any
      }
      return [{ id: 'a', name: 'A', source: 'base', ageGroup: 'Adult' }] as any
    })

    const res = await GET(makeReq('http://localhost/api/surgerySymptoms?surgeryId=s1'))
    expect(res.status).toBe(200)
    const json = await res.json()

    const inUse = json.inUse as Array<{ symptomId: string; isEnabled: boolean; status: string }>
    expect(inUse).toHaveLength(2)
    const a = inUse.find((x) => x.symptomId === 'a')
    const b = inUse.find((x) => x.symptomId === 'b')
    expect(a?.isEnabled).toBe(true)
    expect(a?.status).not.toBe('DISABLED')
    expect(b?.isEnabled).toBe(false)
    expect(b?.status).toBe('DISABLED')
  })
})

