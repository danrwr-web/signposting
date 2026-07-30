/**
 * @jest-environment node
 *
 * Node env: jsdom's File polyfill lacks arrayBuffer(), which the route needs.
 */
import type { NextRequest } from 'next/server'
import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import { requireAdminToolkitItemEdit, requireAdminToolkitWrite } from '@/server/adminToolkitGates'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    adminItemFile: { create: jest.fn() },
  },
}))

jest.mock('@/server/adminToolkitGates', () => ({
  requireAdminToolkitItemEdit: jest.fn(),
  requireAdminToolkitWrite: jest.fn(),
}))

const mockedItemEdit = requireAdminToolkitItemEdit as jest.MockedFunction<typeof requireAdminToolkitItemEdit>
const mockedWrite = requireAdminToolkitWrite as jest.MockedFunction<typeof requireAdminToolkitWrite>

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 1, 2, 3]) // "%PDF-1.4"…

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

describe('POST /api/admin-toolkit/files', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedItemEdit.mockResolvedValue({
      ok: true,
      data: { surgeryId: 'sur-1', itemId: 'item-1', userId: 'u1', canManage: true, isSuperuser: false },
    })
    mockedWrite.mockResolvedValue({
      ok: true,
      data: { surgeryId: 'sur-1', userId: 'u1', isSuperuser: false },
    })
    ;(prisma.adminItemFile.create as jest.Mock).mockResolvedValue({ id: 'file-1' })
  })

  it('returns 400 when file or surgeryId is missing', async () => {
    const res = await POST(makeRequest({ surgeryId: 'sur-1' }))
    expect(res.status).toBe(400)
    const res2 = await POST(makeRequest({ file: makeFile(PDF_BYTES, 'a.pdf', 'application/pdf') }))
    expect(res2.status).toBe(400)
  })

  it('returns 401 when unauthenticated', async () => {
    mockedItemEdit.mockResolvedValue({
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'You must be signed in.' },
    })
    const res = await POST(
      makeRequest({ file: makeFile(PDF_BYTES, 'a.pdf', 'application/pdf'), surgeryId: 'sur-1', itemId: 'item-1' })
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 when the user has no edit grant', async () => {
    mockedItemEdit.mockResolvedValue({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'You do not have permission to edit this item.' },
    })
    const res = await POST(
      makeRequest({ file: makeFile(PDF_BYTES, 'a.pdf', 'application/pdf'), surgeryId: 'sur-1', itemId: 'item-1' })
    )
    expect(res.status).toBe(403)
    expect(prisma.adminItemFile.create).not.toHaveBeenCalled()
  })

  it('returns 415 for a non-PDF MIME type', async () => {
    const res = await POST(
      makeRequest({ file: makeFile(PDF_BYTES, 'a.docx', 'application/msword'), surgeryId: 'sur-1', itemId: 'item-1' })
    )
    expect(res.status).toBe(415)
  })

  it('returns 415 when magic bytes do not match %PDF-', async () => {
    const fake = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07])
    const res = await POST(
      makeRequest({ file: makeFile(fake, 'fake.pdf', 'application/pdf'), surgeryId: 'sur-1', itemId: 'item-1' })
    )
    expect(res.status).toBe(415)
    expect(prisma.adminItemFile.create).not.toHaveBeenCalled()
  })

  it('returns 413 for files over 4MB', async () => {
    const big = new Uint8Array(4 * 1024 * 1024 + 1)
    big.set([0x25, 0x50, 0x44, 0x46, 0x2d])
    const res = await POST(
      makeRequest({ file: makeFile(big, 'big.pdf', 'application/pdf'), surgeryId: 'sur-1', itemId: 'item-1' })
    )
    expect(res.status).toBe(413)
  })

  it('uploads a PDF via the item edit gate and stores magic-byte contentType', async () => {
    const res = await POST(
      makeRequest({
        file: makeFile(PDF_BYTES, 'duty-rota-sop.pdf', 'application/pdf'),
        surgeryId: 'sur-1',
        itemId: 'item-1',
      })
    )
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json).toEqual({ id: 'file-1', url: '/api/admin-toolkit/files/file-1' })
    expect(mockedItemEdit).toHaveBeenCalledWith('sur-1', 'item-1')
    expect(mockedWrite).not.toHaveBeenCalled()
    const created = (prisma.adminItemFile.create as jest.Mock).mock.calls[0][0]
    expect(created.data).toMatchObject({
      surgeryId: 'sur-1',
      adminItemId: 'item-1',
      contentType: 'application/pdf',
      sizeBytes: PDF_BYTES.byteLength,
      filename: 'duty-rota-sop.pdf',
      createdByUserId: 'u1',
    })
  })

  it('uses the admin write gate when no itemId is given (create form)', async () => {
    const res = await POST(
      makeRequest({ file: makeFile(PDF_BYTES, 'policy.pdf', 'application/pdf'), surgeryId: 'sur-1' })
    )
    expect(res.status).toBe(201)
    expect(mockedWrite).toHaveBeenCalledWith('sur-1')
    expect(mockedItemEdit).not.toHaveBeenCalled()
    const created = (prisma.adminItemFile.create as jest.Mock).mock.calls[0][0]
    expect(created.data).toMatchObject({ adminItemId: null, contentType: 'application/pdf' })
  })
})
