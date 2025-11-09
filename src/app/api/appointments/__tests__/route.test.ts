import { NextRequest } from 'next/server'
import { GET } from '../route'
import { getSessionUser, requireSurgeryAccess } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
  requireSurgeryAccess: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    appointmentType: {
      findMany: jest.fn()
    }
  }
}))

const mockedGetSessionUser = getSessionUser as jest.MockedFunction<typeof getSessionUser>
const mockedRequireSurgeryAccess =
  requireSurgeryAccess as jest.MockedFunction<typeof requireSurgeryAccess>
const mockedFindMany = prisma.appointmentType.findMany as jest.MockedFunction<
  typeof prisma.appointmentType.findMany
>

const createRequest = (url: string) => ({ url } as unknown as NextRequest)

describe('GET /api/appointments', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when session is missing', async () => {
    mockedGetSessionUser.mockResolvedValueOnce(null)
    const request = createRequest('https://example.com/api/appointments?surgeryId=test-surgery')

    const response = await GET(request)

    expect(response.status).toBe(401)
    expect(mockedRequireSurgeryAccess).not.toHaveBeenCalled()
    expect(mockedFindMany).not.toHaveBeenCalled()
  })

  it('returns 400 when surgeryId is missing', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({ id: 'user-1' } as any)
    const request = createRequest('https://example.com/api/appointments')

    const response = await GET(request)

    expect(response.status).toBe(400)
    expect(mockedRequireSurgeryAccess).not.toHaveBeenCalled()
  })

  it('fetches appointments for the surgery and query term', async () => {
    const mockAppointments = [
      { id: 'a1', name: 'Flu jab', staffType: 'Nurse', durationMins: 10, notes: null, colour: null }
    ]
    mockedGetSessionUser.mockResolvedValueOnce({ id: 'user-1' } as any)
    mockedRequireSurgeryAccess.mockResolvedValueOnce()
    mockedFindMany.mockResolvedValueOnce(mockAppointments as any)

    const request = createRequest(
      'https://example.com/api/appointments?surgeryId=test-surgery&q=flu'
    )

    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual(mockAppointments)
    expect(mockedRequireSurgeryAccess).toHaveBeenCalledWith('test-surgery')
    expect(mockedFindMany).toHaveBeenCalledWith({
      where: {
        surgeryId: 'test-surgery',
        isEnabled: true,
        name: {
          contains: 'flu',
          mode: 'insensitive'
        }
      },
      orderBy: {
        name: 'asc'
      }
    })
  })
})

