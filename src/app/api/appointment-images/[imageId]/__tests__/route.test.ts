import type { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess } from '@/lib/rbac'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    appointmentImage: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/rbac', () => ({
  requireSurgeryAccess: jest.fn(),
}))

const mockedAccess = requireSurgeryAccess as jest.MockedFunction<typeof requireSurgeryAccess>

const IMAGE_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])

const makeContext = (imageId: string) => ({ params: Promise.resolve({ imageId }) })
const makeReq = (headers: Record<string, string> = {}) =>
  ({ headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } }) as unknown as NextRequest
const req = makeReq()

describe('GET /api/appointment-images/[imageId]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedAccess.mockResolvedValue({ id: 'u1' } as any)
    ;(prisma.appointmentImage.findUnique as jest.Mock).mockResolvedValue({
      surgeryId: 'sur-1',
      contentType: 'image/png',
      data: IMAGE_BYTES,
    })
  })

  it('returns 404 for an unknown image id', async () => {
    ;(prisma.appointmentImage.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await GET(req, makeContext('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when the user has no access to the surgery (no cross-surgery probing)', async () => {
    mockedAccess.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET(req, makeContext('img-1'))
    expect(res.status).toBe(404)
  })

  it('serves the bytes with content type and revalidate-always caching headers', async () => {
    const res = await GET(req, makeContext('img-1'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
    expect(res.headers.get('Content-Length')).toBe(String(IMAGE_BYTES.byteLength))
    // no-cache: the browser must revalidate (re-running the permission gate)
    // before every reuse of a stored copy.
    expect(res.headers.get('Cache-Control')).toBe('private, no-cache')
    expect(res.headers.get('ETag')).toBe('"img-1"')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.equals(IMAGE_BYTES)).toBe(true)
  })

  it('returns 304 without a body when If-None-Match matches', async () => {
    const res = await GET(makeReq({ 'if-none-match': '"img-1"' }), makeContext('img-1'))
    expect(res.status).toBe(304)
    expect(res.headers.get('ETag')).toBe('"img-1"')
    expect((await res.arrayBuffer()).byteLength).toBe(0)
  })

  it('re-runs the permission gate on revalidation (no 304 for revoked access)', async () => {
    mockedAccess.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET(makeReq({ 'if-none-match': '"img-1"' }), makeContext('img-1'))
    expect(res.status).toBe(404)
  })
})
