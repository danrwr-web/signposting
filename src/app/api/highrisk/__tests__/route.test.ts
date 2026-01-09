import { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'

jest.mock('next/cache', () => ({
  unstable_noStore: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    surgery: { findUnique: jest.fn(), findFirst: jest.fn() },
    highRiskLink: { findMany: jest.fn() },
    defaultHighRiskButtonConfig: { findMany: jest.fn() },
  },
}))

const makeReq = (url: string) => ({ url } as unknown as NextRequest)

describe('GET /api/highrisk (freshness)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sets Cache-Control: no-store and reflects latest data on subsequent calls', async () => {
    ;(prisma.surgery.findUnique as jest.Mock).mockImplementation(({ where, select }: any) => {
      // Resolve surgeryId from `?surgery=` param (id path)
      if (where?.id === 's1' && select?.id) return Promise.resolve({ id: 's1' })
      // Fetch surgery config
      if (where?.id === 's1' && select?.enableDefaultHighRisk) return Promise.resolve({ enableDefaultHighRisk: true })
      // Slug lookup not used in this test
      return Promise.resolve(null)
    })

    ;(prisma.defaultHighRiskButtonConfig.findMany as jest.Mock).mockResolvedValue([])

    // First call: no custom links
    ;(prisma.highRiskLink.findMany as jest.Mock).mockResolvedValueOnce([])
    const res1 = await GET(makeReq('http://localhost/api/highrisk?surgery=s1'))
    expect(res1.headers.get('Cache-Control')).toBe('no-store')
    const json1 = await res1.json()
    expect(Array.isArray(json1.links)).toBe(true)
    expect(json1.links.some((l: any) => l.label === 'New custom')).toBe(false)

    // Second call: custom link exists now
    ;(prisma.highRiskLink.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'hr1', label: 'New custom', symptomSlug: 'stroke', symptomId: 'sym1', orderIndex: 0 },
    ])
    const res2 = await GET(makeReq('http://localhost/api/highrisk?surgery=s1'))
    expect(res2.headers.get('Cache-Control')).toBe('no-store')
    const json2 = await res2.json()
    expect(json2.links.some((l: any) => l.label === 'New custom')).toBe(true)
  })
})

