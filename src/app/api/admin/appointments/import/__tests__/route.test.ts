import { NextRequest } from 'next/server'
import { parseCSV, parseDuration, sanitiseRows, POST } from '../route'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/rbac', () => ({
  requireSurgeryAdmin: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn()
  }
}))

const mockedRequireSurgeryAdmin =
  requireSurgeryAdmin as jest.MockedFunction<typeof requireSurgeryAdmin>
const mockedTransaction = prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>

describe('appointments import helpers', () => {
  it('parses CSV with CRLF endings and trims values', () => {
    const csv = 'Appointment Name,Duration,Personnel\r\nFlu jab,10 mins,Nurse\r\n'
    const rows = parseCSV(csv)
    expect(rows).toEqual([
      {
        'Appointment Name': 'Flu jab',
        Duration: '10 mins',
        Personnel: 'Nurse'
      }
    ])
  })

  it('parses varied duration formats', () => {
    expect(parseDuration('15 minutes')).toBe(15)
    expect(parseDuration('20 mins')).toBe(20)
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('not a number')).toBeNull()
  })

  it('flags duplicate names and keeps the first occurrence', () => {
    const { valid, issues } = sanitiseRows([
      { 'Appointment Name': 'Flu jab', Duration: '10', Notes: '', Personnel: 'Nurse' },
      { 'Appointment Name': 'Flu jab', Duration: '15', Notes: '', Personnel: 'Nurse' }
    ])

    expect(valid).toHaveLength(1)
    expect(valid[0]?.name).toBe('Flu jab')
    expect(issues).toEqual([
      expect.objectContaining({
        row: 3,
        reason: expect.stringContaining('Duplicate appointment name')
      })
    ])
  })
})

describe('POST /api/admin/appointments/import', () => {
  const mockFindMany = jest.fn()
  const mockUpdate = jest.fn()
  const mockCreate = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireSurgeryAdmin.mockResolvedValue({ email: 'admin@example.com' } as any)
    mockedTransaction.mockImplementation(async (callback) =>
      callback({
        appointmentType: {
          findMany: mockFindMany,
          update: mockUpdate,
          create: mockCreate
        }
      } as any)
    )
    mockFindMany.mockResolvedValue([])
    mockCreate.mockResolvedValue({ id: 'new', name: 'Flu jab' })
  })

  it('imports new appointments and returns summary information', async () => {
    const csv =
      'Appointment Name,Duration,Personnel,Notes\nFlu jab,10 mins,Nurse,Seasonal vaccine\n'
    const formData = new FormData()
    const file = new File([csv], 'appointments.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(csv)
    })
    formData.append('file', file)
    formData.append('surgeryId', 'surgery-123')

    const request = {
      formData: jest.fn().mockResolvedValue(formData)
    } as unknown as NextRequest

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mockedRequireSurgeryAdmin).toHaveBeenCalledWith('surgery-123')
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        surgeryId: 'surgery-123',
        name: {
          in: ['Flu jab']
        }
      },
      select: {
        id: true,
        name: true
      }
    })
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        surgeryId: 'surgery-123',
        name: 'Flu jab',
        durationMins: 10,
        staffType: 'Nurse',
        notes: 'Seasonal vaccine',
        isEnabled: true,
        lastEditedBy: 'admin@example.com'
      })
    })
    expect(payload).toEqual({
      created: 1,
      updated: 0,
      total: 1,
      skipped: 0,
      issues: []
    })
  })
})

