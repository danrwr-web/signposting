import { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess } from '@/lib/rbac'

jest.mock('@/lib/rbac', () => ({
  requireSurgeryAccess: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    appointmentStaffType: {
      findMany: jest.fn()
    }
  }
}))

const mockedPrisma = prisma as any
const mockedRequireSurgeryAccess = requireSurgeryAccess as jest.MockedFunction<typeof requireSurgeryAccess>

const createRequest = (url: string): NextRequest => ({ url } as unknown as NextRequest)

describe('appointments staff types API', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns enabled staff types for a surgery', async () => {
    mockedRequireSurgeryAccess.mockResolvedValueOnce(undefined)
    mockedPrisma.appointmentStaffType.findMany.mockResolvedValueOnce([
      {
        id: '1',
        label: 'PN',
        normalizedLabel: 'PN',
        defaultColour: 'bg-nhs-green-tint',
        isBuiltIn: true,
        isEnabled: true,
        orderIndex: 1,
        surgeryId: null
      }
    ])

    const response = await GET(createRequest('https://example.com/api/appointments/staff-types?surgeryId=abc'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.staffTypes).toHaveLength(1)
    expect(mockedRequireSurgeryAccess).toHaveBeenCalledWith('abc')
  })
})
