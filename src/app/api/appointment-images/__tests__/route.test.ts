/**
 * @jest-environment node
 *
 * Node env: jsdom's File polyfill lacks arrayBuffer(), which the route needs.
 */
import type { NextRequest } from 'next/server'
import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAdmin } from '@/lib/rbac'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    appointmentImage: { create: jest.fn() },
    appointmentType: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/rbac', () => ({
  requireSurgeryAdmin: jest.fn(),
}))

const mockedAdmin = requireSurgeryAdmin as jest.MockedFunction<typeof requireSurgeryAdmin>

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])

function makeFile(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes as BlobPart], name, { type })
}

function makeRequest(fields: { file?: File; surgeryId?: string; itemId?: string }): NextRequest {
  const form = new FormData()
  if (fields.file) form.append('file', fields.file)
  if (fields.surgeryId !== undefined) form.append('surgeryId', fields.surgeryId)
  if (fields.itemId !== undefined) form.append('itemId', fields.itemId)
  return { formData: async () => form } as unknown as NextRequest
}

describe('POST /api/appointment-images', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedAdmin.mockResolvedValue({ id: 'u1' } as any)
    ;(prisma.appointmentType.findFirst as jest.Mock).mockResolvedValue({ id: 'apt-1' })
    ;(prisma.appointmentImage.create as jest.Mock).mockResolvedValue({ id: 'img-1' })
  })

  it('returns 400 when file or surgeryId is missing', async () => {
    const res = await POST(makeRequest({ surgeryId: 'sur-1' }))
    expect(res.status).toBe(400)
    const res2 = await POST(makeRequest({ file: makeFile(PNG_BYTES, 'a.png', 'image/png') }))
    expect(res2.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    mockedAdmin.mockRejectedValue(new Error('Authentication required'))
    const res = await POST(
      makeRequest({ file: makeFile(PNG_BYTES, 'a.png', 'image/png'), surgeryId: 'sur-1' })
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 when the user is not a surgery admin', async () => {
    mockedAdmin.mockRejectedValue(new Error('Surgery admin access required'))
    const res = await POST(
      makeRequest({ file: makeFile(PNG_BYTES, 'a.png', 'image/png'), surgeryId: 'sur-1' })
    )
    expect(res.status).toBe(403)
    expect(prisma.appointmentImage.create).not.toHaveBeenCalled()
  })

  it('returns 404 when itemId belongs to a different surgery', async () => {
    ;(prisma.appointmentType.findFirst as jest.Mock).mockResolvedValue(null)
    const res = await POST(
      makeRequest({ file: makeFile(PNG_BYTES, 'a.png', 'image/png'), surgeryId: 'sur-1', itemId: 'other-apt' })
    )
    expect(res.status).toBe(404)
    expect(prisma.appointmentType.findFirst).toHaveBeenCalledWith({
      where: { id: 'other-apt', surgeryId: 'sur-1' },
      select: { id: true },
    })
    expect(prisma.appointmentImage.create).not.toHaveBeenCalled()
  })

  it('returns 415 for a non-JPG/PNG MIME type', async () => {
    const res = await POST(
      makeRequest({ file: makeFile(PNG_BYTES, 'a.gif', 'image/gif'), surgeryId: 'sur-1' })
    )
    expect(res.status).toBe(415)
  })

  it('returns 415 when magic bytes do not match an image', async () => {
    const fake = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07])
    const res = await POST(
      makeRequest({ file: makeFile(fake, 'fake.png', 'image/png'), surgeryId: 'sur-1' })
    )
    expect(res.status).toBe(415)
    expect(prisma.appointmentImage.create).not.toHaveBeenCalled()
  })

  it('returns 413 for files over 2MB', async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1)
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const res = await POST(
      makeRequest({ file: makeFile(big, 'big.png', 'image/png'), surgeryId: 'sur-1' })
    )
    expect(res.status).toBe(413)
  })

  it('uploads a PNG for an existing appointment and stores magic-byte contentType', async () => {
    const res = await POST(
      makeRequest({
        // Client says jpeg, bytes say PNG — stored contentType must follow the bytes.
        file: makeFile(PNG_BYTES, 'clinic.jpeg', 'image/jpeg'),
        surgeryId: 'sur-1',
        itemId: 'apt-1',
      })
    )
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual({ id: 'img-1', url: '/api/appointment-images/img-1' })
    expect(mockedAdmin).toHaveBeenCalledWith('sur-1')
    const created = (prisma.appointmentImage.create as jest.Mock).mock.calls[0][0]
    expect(created.data).toMatchObject({
      surgeryId: 'sur-1',
      appointmentTypeId: 'apt-1',
      contentType: 'image/png',
      sizeBytes: PNG_BYTES.byteLength,
      filename: 'clinic.jpeg',
      createdByUserId: 'u1',
    })
  })

  it('stores an unowned row when no itemId is given (create modal)', async () => {
    const res = await POST(
      makeRequest({ file: makeFile(JPEG_BYTES, 'photo.jpg', 'image/jpeg'), surgeryId: 'sur-1' })
    )
    expect(res.status).toBe(201)
    expect(prisma.appointmentType.findFirst).not.toHaveBeenCalled()
    const created = (prisma.appointmentImage.create as jest.Mock).mock.calls[0][0]
    expect(created.data).toMatchObject({ appointmentTypeId: null, contentType: 'image/jpeg' })
  })
})
