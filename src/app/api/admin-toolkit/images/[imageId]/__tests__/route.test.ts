import type { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { canUserViewAdminItemInCategory } from '@/server/adminToolkitGates'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    adminItemImage: { findUnique: jest.fn() },
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

const IMAGE_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])

const makeContext = (imageId: string) => ({ params: Promise.resolve({ imageId }) })
const req = {} as NextRequest

describe('GET /api/admin-toolkit/images/[imageId]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedAccess.mockResolvedValue({ id: 'u1' } as any)
    mockedFeature.mockResolvedValue(true)
    mockedCanView.mockResolvedValue(true)
    ;(prisma.adminItemImage.findUnique as jest.Mock).mockResolvedValue({
      surgeryId: 'sur-1',
      adminItemId: 'item-1',
      contentType: 'image/png',
      data: IMAGE_BYTES,
    })
    ;(prisma.adminItem.findFirst as jest.Mock).mockResolvedValue({ categoryId: 'cat-1' })
  })

  it('returns 404 for an unknown image id', async () => {
    ;(prisma.adminItemImage.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await GET(req, makeContext('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when the user has no access to the surgery (no cross-surgery probing)', async () => {
    mockedAccess.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET(req, makeContext('img-1'))
    expect(res.status).toBe(404)
  })

  it('returns 403 when the handbook feature is disabled', async () => {
    mockedFeature.mockResolvedValue(false)
    const res = await GET(req, makeContext('img-1'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when the user cannot view the item category', async () => {
    mockedCanView.mockResolvedValue(false)
    const res = await GET(req, makeContext('img-1'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when the attached item is deleted', async () => {
    ;(prisma.adminItem.findFirst as jest.Mock).mockResolvedValue(null)
    const res = await GET(req, makeContext('img-1'))
    expect(res.status).toBe(404)
  })

  it('serves the bytes with content type and private caching headers', async () => {
    const res = await GET(req, makeContext('img-1'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
    expect(res.headers.get('Content-Length')).toBe(String(IMAGE_BYTES.byteLength))
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=31536000, immutable')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.equals(IMAGE_BYTES)).toBe(true)
  })

  it('skips the item visibility check for images without an item', async () => {
    ;(prisma.adminItemImage.findUnique as jest.Mock).mockResolvedValue({
      surgeryId: 'sur-1',
      adminItemId: null,
      contentType: 'image/jpeg',
      data: IMAGE_BYTES,
    })
    const res = await GET(req, makeContext('img-2'))
    expect(res.status).toBe(200)
    expect(mockedCanView).not.toHaveBeenCalled()
  })
})
