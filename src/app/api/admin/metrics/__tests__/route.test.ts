import { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'
import { getSessionUser, can } from '@/lib/rbac'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    symptomReviewStatus: { findMany: jest.fn() },
    suggestion: { findMany: jest.fn() },
    surgeryOnboardingProfile: { findUnique: jest.fn() },
    surgerySymptomOverride: { findMany: jest.fn() },
    surgeryCustomSymptom: { findMany: jest.fn() },
    symptomHistory: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
  can: jest.fn(),
}))

jest.mock('@/server/effectiveSymptoms', () => ({
  getEffectiveSymptoms: jest.fn(),
}))

const mockedGetSessionUser = getSessionUser as jest.MockedFunction<typeof getSessionUser>
const mockedCan = can as unknown as jest.MockedFunction<typeof can>
const mockedGetEffectiveSymptoms = getEffectiveSymptoms as jest.MockedFunction<typeof getEffectiveSymptoms>

const makeReq = (url: string) => ({ url } as unknown as NextRequest)

describe('GET /api/admin/metrics (pendingReviewCount)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetSessionUser.mockResolvedValue({ id: 'u1' } as any)
    mockedCan.mockReturnValue({
      isSuperuser: () => true,
      manageSurgery: () => true,
    } as any)

    ;(prisma.suggestion.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.surgeryOnboardingProfile.findUnique as jest.Mock).mockResolvedValue({ completed: true, profileJson: {} })
    ;(prisma.surgerySymptomOverride.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.surgeryCustomSymptom.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.symptomHistory.findFirst as jest.Mock).mockResolvedValue(null)
  })

  it('counts unreviewed symptoms as pending', async () => {
    mockedGetEffectiveSymptoms.mockResolvedValueOnce([
      { id: 's1', ageGroup: 'Adult' },
    ] as any)
    ;(prisma.symptomReviewStatus.findMany as jest.Mock).mockResolvedValueOnce([])

    const res = await GET(makeReq('http://localhost/api/admin/metrics?surgeryId=sur-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.pendingReviewCount).toBe(1)
  })

  it('counts explicit PENDING statuses for existing symptoms', async () => {
    mockedGetEffectiveSymptoms.mockResolvedValueOnce([
      { id: 's1', ageGroup: 'Adult' },
    ] as any)
    ;(prisma.symptomReviewStatus.findMany as jest.Mock).mockResolvedValueOnce([
      { symptomId: 's1', ageGroup: 'Adult', status: 'PENDING' },
    ])

    const res = await GET(makeReq('http://localhost/api/admin/metrics?surgeryId=sur-1'))
    const json = await res.json()
    expect(json.pendingReviewCount).toBe(1)
  })

  it('decrements pending count when symptom is approved', async () => {
    mockedGetEffectiveSymptoms.mockResolvedValueOnce([
      { id: 's1', ageGroup: 'Adult' },
    ] as any)
    ;(prisma.symptomReviewStatus.findMany as jest.Mock).mockResolvedValueOnce([
      { symptomId: 's1', ageGroup: 'Adult', status: 'APPROVED' },
    ])

    const res = await GET(makeReq('http://localhost/api/admin/metrics?surgeryId=sur-1'))
    const json = await res.json()
    expect(json.pendingReviewCount).toBe(0)
  })

  it('does not count pending statuses for deleted symptoms (not in effective list)', async () => {
    mockedGetEffectiveSymptoms.mockResolvedValueOnce([] as any)
    ;(prisma.symptomReviewStatus.findMany as jest.Mock).mockResolvedValueOnce([
      { symptomId: 'deleted-1', ageGroup: 'Adult', status: 'PENDING' },
    ])

    const res = await GET(makeReq('http://localhost/api/admin/metrics?surgeryId=sur-1'))
    const json = await res.json()
    expect(json.pendingReviewCount).toBe(0)
  })
})

