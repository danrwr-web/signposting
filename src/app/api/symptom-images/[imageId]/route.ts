import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, requireSurgeryAccess } from '@/lib/rbac'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ imageId: string }> },
) {
  try {
    const { imageId } = await context.params

    const image = await prisma.symptomImage.findUnique({
      where: { id: imageId },
      select: { surgeryId: true, contentType: true, data: true },
    })
    if (!image) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (image.surgeryId) {
      try {
        await requireSurgeryAccess(image.surgeryId)
      } catch {
        // 404 (not 403) so image ids can't be probed across surgeries.
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
    } else {
      // Global image (base-symptom content): any authenticated user can view.
      const user = await getSessionUser()
      if (!user) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
    }

    // no-cache (not immutable): the browser may store the bytes but must
    // revalidate on every use, so the permission gates above re-run and a
    // signed-out or revoked user can't keep reading a cached copy. Bytes are
    // immutable per id, so revalidation is a cheap 304 via the id ETag.
    const etag = `"${imageId}"`
    const cacheHeaders = {
      'Cache-Control': 'private, no-cache',
      ETag: etag,
    }

    const ifNoneMatch = request.headers.get('if-none-match')
    if (ifNoneMatch && ifNoneMatch.split(',').some((v) => v.trim().replace(/^W\//, '') === etag)) {
      return new NextResponse(null, { status: 304, headers: cacheHeaders })
    }

    const body = Buffer.from(image.data)
    return new NextResponse(body, {
      status: 200,
      headers: {
        ...cacheHeaders,
        'Content-Type': image.contentType,
        'Content-Length': String(body.byteLength),
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    })
  } catch (error) {
    console.error('Error serving symptom image:', error)
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 })
  }
}
