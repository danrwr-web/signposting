import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { canUserViewAdminItemInCategory } from '@/server/adminToolkitGates'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ imageId: string }> },
) {
  try {
    const { imageId } = await context.params

    const image = await prisma.adminItemImage.findUnique({
      where: { id: imageId },
      select: { surgeryId: true, adminItemId: true, contentType: true, data: true },
    })
    if (!image) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let user
    try {
      user = await requireSurgeryAccess(image.surgeryId)
    } catch {
      // 404 (not 403) so image ids can't be probed across surgeries.
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const enabled = await isFeatureEnabledForSurgery(image.surgeryId, 'admin_toolkit')
    if (!enabled) {
      return NextResponse.json({ error: 'Practice Handbook is not enabled' }, { status: 403 })
    }

    // Images attached to an item inherit its category visibility, so content
    // in a restricted category can't be fetched by users who can't see it.
    if (image.adminItemId) {
      const item = await prisma.adminItem.findFirst({
        where: { id: image.adminItemId, surgeryId: image.surgeryId, deletedAt: null },
        select: { categoryId: true },
      })
      if (!item || !(await canUserViewAdminItemInCategory(user, image.surgeryId, item.categoryId))) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
    }

    const body = Buffer.from(image.data)
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': image.contentType,
        'Content-Length': String(body.byteLength),
        // Image bytes are immutable per id (uploads are never mutated), so
        // long-lived private caching is safe.
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    })
  } catch (error) {
    console.error('Error serving admin toolkit image:', error)
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 })
  }
}
