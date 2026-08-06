/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { PATCH } from '../route'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/rbac', () => ({
  requireSurgeryAdmin: jest.fn()
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    appointmentType: { findUnique: jest.fn() },
    $transaction: jest.fn()
  }
}))

const mockedRequireSurgeryAdmin =
  requireSurgeryAdmin as jest.MockedFunction<typeof requireSurgeryAdmin>
const mockedTransaction = prisma.$transaction as jest.MockedFunction<typeof prisma.$transaction>

const makeRequest = (body: unknown): NextRequest =>
  ({ json: async () => body }) as unknown as NextRequest
const makeContext = (id: string) => ({ params: Promise.resolve({ id }) })

describe('PATCH /api/admin/appointments/[id]', () => {
  const mockUpdate = jest.fn()
  const mockUpdateManyImages = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireSurgeryAdmin.mockResolvedValue({ email: 'admin@example.com' } as any)
    ;(prisma.appointmentType.findUnique as jest.Mock).mockResolvedValue({ surgeryId: 'sur-1' })
    mockedTransaction.mockImplementation(async (callback) =>
      callback({
        appointmentType: { update: mockUpdate },
        appointmentImage: { updateMany: mockUpdateManyImages }
      } as any)
    )
    mockUpdate.mockResolvedValue({ id: 'apt-1', name: 'Flu jab' })
  })

  it('sanitizes notesHtml, derives plain notes and claims unowned images', async () => {
    const res = await PATCH(
      makeRequest({
        notesHtml:
          '<p>Bring a <em>list</em></p><p><img src="/api/appointment-images/clximg1" alt="" /></p><script>x</script>'
      }),
      makeContext('apt-1')
    )
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'apt-1' },
      data: expect.objectContaining({
        notesHtml:
          '<p>Bring a <em>list</em></p><p><img src="/api/appointment-images/clximg1" alt="" /></p>',
        notes: 'Bring a list'
      })
    })
    expect(mockUpdateManyImages).toHaveBeenCalledWith({
      where: { id: { in: ['clximg1'] }, surgeryId: 'sur-1', appointmentTypeId: null },
      data: { appointmentTypeId: 'apt-1' }
    })
  })

  it('clears both fields when notesHtml is emptied', async () => {
    const res = await PATCH(makeRequest({ notesHtml: '<p></p>' }), makeContext('apt-1'))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'apt-1' },
      data: expect.objectContaining({ notesHtml: null, notes: null })
    })
    expect(mockUpdateManyImages).not.toHaveBeenCalled()
  })

  it('clears notesHtml when a legacy plain-notes payload is sent', async () => {
    const res = await PATCH(makeRequest({ notes: 'Plain update' }), makeContext('apt-1'))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'apt-1' },
      data: expect.objectContaining({ notes: 'Plain update', notesHtml: null })
    })
  })

  it('leaves notes fields untouched when neither is sent', async () => {
    const res = await PATCH(makeRequest({ name: 'Renamed' }), makeContext('apt-1'))
    expect(res.status).toBe(200)
    const data = mockUpdate.mock.calls[0][0].data
    expect(data).not.toHaveProperty('notes')
    expect(data).not.toHaveProperty('notesHtml')
  })

  it('returns 404 for an unknown appointment', async () => {
    ;(prisma.appointmentType.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ name: 'x' }), makeContext('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 403 when the user is not a surgery admin', async () => {
    mockedRequireSurgeryAdmin.mockRejectedValue(new Error('Surgery admin access required'))
    const res = await PATCH(makeRequest({ name: 'x' }), makeContext('apt-1'))
    expect(res.status).toBe(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
