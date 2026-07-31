/**
 * @jest-environment node
 *
 * Node env: jsdom's File polyfill lacks arrayBuffer(), which the route needs.
 */
import type { NextRequest } from 'next/server'
import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAdmin, requireSuperuser } from '@/lib/rbac'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    symptomImage: { create: jest.fn() },
  },
}))

jest.mock('@/lib/rbac', () => ({
  requireSurgeryAdmin: jest.fn(),
  requireSuperuser: jest.fn(),
}))

const mockedSurgeryAdmin = requireSurgeryAdmin as jest.MockedFunction<typeof requireSurgeryAdmin>
const mockedSuperuser = requireSuperuser as jest.MockedFunction<typeof requireSuperuser>

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])

function makeFile(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes as BlobPart], name, { type })
}

function makeRequest(fields: { file?: File; surgeryId?: string }): NextRequest {
  const form = new FormData()
  if (fields.file) form.append('file', fields.file)
  if (fields.surgeryId !== undefined) form.append('surgeryId', fields.surgeryId)
  return { formData: async () => form } as unknown as NextRequest
}

describe('POST /api/symptom-images', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedSurgeryAdmin.mockResolvedValue({ id: 'u1' } as any)
    mockedSuperuser.mockResolvedValue({ id: 'su1' } as any)
    ;(prisma.symptomImage.create as jest.Mock).mockResolvedValue({ id: 'img-1' })
  })

  it('returns 400 when the file is missing', async () => {
    const res = await POST(makeRequest({ surgeryId: 'sur-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    mockedSurgeryAdmin.mockRejectedValue(new Error('Authentication required'))
    const res = await POST(
      makeRequest({ file: makeFile(PNG_BYTES, 'a.png', 'image/png'), surgeryId: 'sur-1' })
    )
    expect(res.status).toBe(401)
    expect(prisma.symptomImage.create).not.toHaveBeenCalled()
  })

  it('returns 403 when the user is not an admin of the surgery', async () => {
    mockedSurgeryAdmin.mockRejectedValue(new Error('Surgery admin access required'))
    const res = await POST(
      makeRequest({ file: makeFile(PNG_BYTES, 'a.png', 'image/png'), surgeryId: 'sur-1' })
    )
    expect(res.status).toBe(403)
    expect(prisma.symptomImage.create).not.toHaveBeenCalled()
  })

  it('requires superuser when no surgeryId is given (global image)', async () => {
    mockedSuperuser.mockRejectedValue(new Error('Superuser access required'))
    const res = await POST(makeRequest({ file: makeFile(PNG_BYTES, 'a.png', 'image/png') }))
    expect(res.status).toBe(403)
    expect(mockedSurgeryAdmin).not.toHaveBeenCalled()
    expect(prisma.symptomImage.create).not.toHaveBeenCalled()
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
    expect(prisma.symptomImage.create).not.toHaveBeenCalled()
  })

  it('returns 413 for files over 2MB', async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1)
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const res = await POST(
      makeRequest({ file: makeFile(big, 'big.png', 'image/png'), surgeryId: 'sur-1' })
    )
    expect(res.status).toBe(413)
  })

  it('uploads a surgery-scoped PNG and stores magic-byte contentType', async () => {
    const res = await POST(
      makeRequest({
        // Client says jpeg, bytes say PNG — stored contentType must follow the bytes.
        file: makeFile(PNG_BYTES, 'chart.jpeg', 'image/jpeg'),
        surgeryId: 'sur-1',
      })
    )
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual({ id: 'img-1', url: '/api/symptom-images/img-1' })
    expect(mockedSurgeryAdmin).toHaveBeenCalledWith('sur-1')
    expect(mockedSuperuser).not.toHaveBeenCalled()
    const created = (prisma.symptomImage.create as jest.Mock).mock.calls[0][0]
    expect(created.data).toMatchObject({
      surgeryId: 'sur-1',
      contentType: 'image/png',
      sizeBytes: PNG_BYTES.byteLength,
      filename: 'chart.jpeg',
      createdByUserId: 'u1',
    })
  })

  it('stores a global image (null surgeryId) for superuser uploads', async () => {
    const res = await POST(makeRequest({ file: makeFile(JPEG_BYTES, 'photo.jpg', 'image/jpeg') }))
    expect(res.status).toBe(201)
    expect(mockedSuperuser).toHaveBeenCalled()
    expect(mockedSurgeryAdmin).not.toHaveBeenCalled()
    const created = (prisma.symptomImage.create as jest.Mock).mock.calls[0][0]
    expect(created.data).toMatchObject({
      surgeryId: null,
      contentType: 'image/jpeg',
      createdByUserId: 'su1',
    })
  })
})
