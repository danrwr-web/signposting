import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import { PATCH, DELETE } from '../[id]/route'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAdmin } from '@/lib/rbac'

jest.mock('@/lib/rbac', () => ({
  requireSurgeryAdmin: jest.fn()
}))

type PrismaMock = typeof prisma

jest.mock('@/lib/prisma', () => ({
  prisma: {
    appointmentStaffType: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    appointmentType: {
      updateMany: jest.fn()
    },
    $transaction: jest.fn()
  }
}))

const mockedPrisma = prisma as unknown as PrismaMock
const mockedRequireSurgeryAdmin = requireSurgeryAdmin as jest.MockedFunction<typeof requireSurgeryAdmin>

const createRequest = (url: string, body?: Record<string, unknown>): NextRequest => {
  return {
    url,
    json: async () => body
  } as unknown as NextRequest
}

describe('admin staff types API', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('lists staff types for a surgery', async () => {
    mockedRequireSurgeryAdmin.mockResolvedValueOnce({ email: 'admin@example.com' } as any)
    ;(mockedPrisma.appointmentStaffType.findMany as jest.Mock).mockResolvedValueOnce([
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

    const request = createRequest('https://example.com/api/admin/appointments/staff-types?surgeryId=abc')
    const response = await GET(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.staffTypes).toHaveLength(1)
    expect(mockedRequireSurgeryAdmin).toHaveBeenCalledWith('abc')
  })

  it('creates a new staff type', async () => {
    mockedRequireSurgeryAdmin.mockResolvedValueOnce({ email: 'admin@example.com' } as any)
    ;(mockedPrisma.appointmentStaffType.findFirst as jest.Mock).mockResolvedValueOnce(null)
    ;(mockedPrisma.appointmentStaffType.count as jest.Mock).mockResolvedValueOnce(2)
    ;(mockedPrisma.appointmentStaffType.create as jest.Mock).mockResolvedValueOnce({
      id: 'new',
      label: 'Paramedic',
      normalizedLabel: 'PARAMEDIC',
      defaultColour: '#00FF00',
      isBuiltIn: false,
      isEnabled: true,
      orderIndex: 102,
      surgeryId: 'abc'
    })

    const request = createRequest('https://example.com/api/admin/appointments/staff-types', {
      surgeryId: 'abc',
      label: 'Paramedic',
      defaultColour: '#00FF00'
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.label).toBe('Paramedic')
    expect(mockedPrisma.appointmentStaffType.create).toHaveBeenCalled()
  })

  it('updates a custom staff type colour', async () => {
    ;(mockedPrisma.appointmentStaffType.findUnique as jest.Mock).mockResolvedValue({
      id: 'custom-1',
      label: 'Paramedic',
      normalizedLabel: 'PARAMEDIC',
      defaultColour: null,
      isBuiltIn: false,
      isEnabled: true,
      orderIndex: 100,
      surgeryId: 'abc'
    })
    mockedRequireSurgeryAdmin.mockResolvedValueOnce({ email: 'admin@example.com' } as any)
    ;(mockedPrisma.appointmentStaffType.update as jest.Mock).mockResolvedValue({
      id: 'custom-1',
      label: 'Paramedic',
      normalizedLabel: 'PARAMEDIC',
      defaultColour: '#FFFFFF',
      isBuiltIn: false,
      isEnabled: true,
      orderIndex: 100,
      surgeryId: 'abc'
    })

    const request = createRequest('https://example.com/api/admin/appointments/staff-types/custom-1', {
      defaultColour: '#FFFFFF'
    })

    const response = await PATCH(request, { params: { id: 'custom-1' } })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.defaultColour).toBe('#FFFFFF')
    expect(mockedPrisma.appointmentStaffType.update).toHaveBeenCalled()
  })

  it('deletes a custom staff type', async () => {
    ;(mockedPrisma.appointmentStaffType.findUnique as jest.Mock).mockResolvedValue({
      id: 'custom-2',
      label: 'Paramedic',
      normalizedLabel: 'PARAMEDIC',
      defaultColour: null,
      isBuiltIn: false,
      isEnabled: true,
      orderIndex: 100,
      surgeryId: 'abc'
    })
    mockedRequireSurgeryAdmin.mockResolvedValueOnce({ email: 'admin@example.com' } as any)
    ;(mockedPrisma.appointmentType.updateMany as jest.Mock).mockResolvedValue({ count: 3 })
    ;(mockedPrisma.appointmentStaffType.delete as jest.Mock).mockResolvedValue({})
    ;(mockedPrisma.$transaction as jest.Mock).mockResolvedValue(undefined)

    const request = createRequest('https://example.com/api/admin/appointments/staff-types/custom-2')

    const response = await DELETE(request, { params: { id: 'custom-2' } })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(mockedPrisma.appointmentType.updateMany).toHaveBeenCalled()
    expect(mockedPrisma.appointmentStaffType.delete).toHaveBeenCalledWith({ where: { id: 'custom-2' } })
  })
})
