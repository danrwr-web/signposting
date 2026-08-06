/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { POST } from '../route'
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

const makeRequest = (body: unknown): NextRequest =>
  ({ json: async () => body }) as unknown as NextRequest

describe('POST /api/admin/appointments', () => {
  const mockCreate = jest.fn()
  const mockUpdateManyImages = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireSurgeryAdmin.mockResolvedValue({ email: 'admin@example.com' } as any)
    mockedTransaction.mockImplementation(async (callback) =>
      callback({
        appointmentType: { create: mockCreate },
        appointmentImage: { updateMany: mockUpdateManyImages }
      } as any)
    )
    mockCreate.mockResolvedValue({ id: 'apt-1', name: 'Flu jab' })
  })

  it('sanitizes notesHtml and derives plain notes from it', async () => {
    const res = await POST(
      makeRequest({
        surgeryId: 'sur-1',
        name: 'Flu jab',
        notesHtml: '<p>Book <strong>early</strong></p><script>alert(1)</script>'
      })
    )
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        notesHtml: '<p>Book <strong>early</strong></p>',
        notes: 'Book early'
      })
    })
    expect(mockUpdateManyImages).not.toHaveBeenCalled()
  })

  it('claims unowned images referenced by the notes', async () => {
    const res = await POST(
      makeRequest({
        surgeryId: 'sur-1',
        name: 'Flu jab',
        notesHtml: '<p><img src="/api/appointment-images/clximg1" alt="" /></p>'
      })
    )
    expect(res.status).toBe(201)
    expect(mockUpdateManyImages).toHaveBeenCalledWith({
      where: { id: { in: ['clximg1'] }, surgeryId: 'sur-1', appointmentTypeId: null },
      data: { appointmentTypeId: 'apt-1' }
    })
  })

  it('strips foreign image routes so their ids are never claimed', async () => {
    const res = await POST(
      makeRequest({
        surgeryId: 'sur-1',
        name: 'Flu jab',
        notesHtml: '<p>x</p><p><img src="/api/admin-toolkit/images/clxforeign" /></p>'
      })
    )
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ notesHtml: '<p>x</p><p></p>' })
    })
    expect(mockUpdateManyImages).not.toHaveBeenCalled()
  })

  it('stores null for effectively empty notesHtml', async () => {
    const res = await POST(
      makeRequest({ surgeryId: 'sur-1', name: 'Flu jab', notesHtml: '<p></p>' })
    )
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ notesHtml: null, notes: null })
    })
  })

  it('still accepts a legacy plain-notes payload', async () => {
    const res = await POST(
      makeRequest({ surgeryId: 'sur-1', name: 'Flu jab', notes: 'Plain note' })
    )
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ notes: 'Plain note', notesHtml: null })
    })
  })

  it('returns 403 when the user is not a surgery admin', async () => {
    mockedRequireSurgeryAdmin.mockRejectedValue(new Error('Surgery admin access required'))
    const res = await POST(makeRequest({ surgeryId: 'sur-1', name: 'Flu jab' }))
    expect(res.status).toBe(403)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
