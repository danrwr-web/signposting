import type { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { canUserViewAdminItemInCategory } from '@/server/adminToolkitGates'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    adminItemFile: { findUnique: jest.fn() },
    adminItem: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/rbac', () => ({
  requireSurgeryAccess: jest.fn(),
}))

jest.mock('@/lib/features', () => ({
  isFeatureEnabledForSurgery: jest.fn(),
}))

jest.mock('@/server/adminToolkitGates', () => ({
  canUserViewAdminItemInCategory: jest.fn(),
}))

const mockedAccess = requireSurgeryAccess as jest.MockedFunction<typeof requireSurgeryAccess>
const mockedFeature = isFeatureEnabledForSurgery as jest.MockedFunction<typeof isFeatureEnabledForSurgery>
const mockedCanView = canUserViewAdminItemInCategory as jest.MockedFunction<typeof canUserViewAdminItemInCategory>

const PDF_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3])

const makeContext = (fileId: string) => ({ params: Promise.resolve({ fileId }) })
const makeReq = (headers: Record<string, string> = {}) =>
  ({ headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } }) as unknown as NextRequest
const req = makeReq()

describe('GET /api/admin-toolkit/files/[fileId]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedAccess.mockResolvedValue({ id: 'u1' } as any)
    mockedFeature.mockResolvedValue(true)
    mockedCanView.mockResolvedValue(true)
    ;(prisma.adminItemFile.findUnique as jest.Mock).mockResolvedValue({
      surgeryId: 'sur-1',
      adminItemId: 'item-1',
      contentType: 'application/pdf',
      data: PDF_BYTES,
      filename: 'duty-rota-sop.pdf',
    })
    ;(prisma.adminItem.findFirst as jest.Mock).mockResolvedValue({ categoryId: 'cat-1' })
  })

  it('returns 404 for an unknown file id', async () => {
    ;(prisma.adminItemFile.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await GET(req, makeContext('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when the user has no access to the surgery (no cross-surgery probing)', async () => {
    mockedAccess.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET(req, makeContext('file-1'))
    expect(res.status).toBe(404)
  })

  it('returns 403 when the handbook feature is disabled', async () => {
    mockedFeature.mockResolvedValue(false)
    const res = await GET(req, makeContext('file-1'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when the user cannot view the item category', async () => {
    mockedCanView.mockResolvedValue(false)
    const res = await GET(req, makeContext('file-1'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when the attached item is deleted', async () => {
    ;(prisma.adminItem.findFirst as jest.Mock).mockResolvedValue(null)
    const res = await GET(req, makeContext('file-1'))
    expect(res.status).toBe(404)
  })

  it('serves the bytes with PDF headers, revalidate-always caching and a script-blocking sandbox', async () => {
    const res = await GET(req, makeContext('file-1'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Length')).toBe(String(PDF_BYTES.byteLength))
    // no-cache: the browser must revalidate (re-running the permission gates)
    // before every reuse of a stored copy.
    expect(res.headers.get('Cache-Control')).toBe('private, no-cache')
    expect(res.headers.get('ETag')).toBe('"file-1"')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    // Inline preview is allowed, but embedded PDF scripts must not run.
    expect(res.headers.get('Content-Security-Policy')).toBe('sandbox')
    expect(res.headers.get('Content-Disposition')).toBe('inline; filename="duty-rota-sop.pdf"')
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.equals(PDF_BYTES)).toBe(true)
  })

  it('returns 304 without a body when If-None-Match matches', async () => {
    const res = await GET(makeReq({ 'if-none-match': '"file-1"' }), makeContext('file-1'))
    expect(res.status).toBe(304)
    expect(res.headers.get('ETag')).toBe('"file-1"')
    expect((await res.arrayBuffer()).byteLength).toBe(0)
  })

  it('re-runs the permission gates on revalidation (no 304 for revoked access)', async () => {
    mockedAccess.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET(makeReq({ 'if-none-match': '"file-1"' }), makeContext('file-1'))
    expect(res.status).toBe(404)
  })

  it('sanitises the filename in Content-Disposition', async () => {
    ;(prisma.adminItemFile.findUnique as jest.Mock).mockResolvedValue({
      surgeryId: 'sur-1',
      adminItemId: 'item-1',
      contentType: 'application/pdf',
      data: PDF_BYTES,
      filename: 'weird"name\r\n;.pdf',
    })
    const res = await GET(req, makeContext('file-1'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toBe('inline; filename="weird_name___.pdf"')
  })

  it('skips the item visibility check for files without an item', async () => {
    ;(prisma.adminItemFile.findUnique as jest.Mock).mockResolvedValue({
      surgeryId: 'sur-1',
      adminItemId: null,
      contentType: 'application/pdf',
      data: PDF_BYTES,
      filename: 'policy.pdf',
    })
    const res = await GET(req, makeContext('file-2'))
    expect(res.status).toBe(200)
    expect(mockedCanView).not.toHaveBeenCalled()
  })
})
