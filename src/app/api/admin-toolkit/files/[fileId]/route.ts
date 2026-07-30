import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { canUserViewAdminItemInCategory } from '@/server/adminToolkitGates'

export const runtime = 'nodejs'

/** Header-safe ASCII filename for Content-Disposition. */
function safeFilename(filename: string): string {
  const cleaned = filename.replace(/[^a-zA-Z0-9._ -]/g, '_').trim()
  return cleaned || 'document.pdf'
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await context.params

    const file = await prisma.adminItemFile.findUnique({
      where: { id: fileId },
      select: { surgeryId: true, adminItemId: true, contentType: true, data: true, filename: true },
    })
    if (!file) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let user
    try {
      user = await requireSurgeryAccess(file.surgeryId)
    } catch {
      // 404 (not 403) so file ids can't be probed across surgeries.
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const enabled = await isFeatureEnabledForSurgery(file.surgeryId, 'admin_toolkit')
    if (!enabled) {
      return NextResponse.json({ error: 'Practice Handbook is not enabled' }, { status: 403 })
    }

    // Files attached to an item inherit its category visibility, so content
    // in a restricted category can't be fetched by users who can't see it.
    if (file.adminItemId) {
      const item = await prisma.adminItem.findFirst({
        where: { id: file.adminItemId, surgeryId: file.surgeryId, deletedAt: null },
        select: { categoryId: true },
      })
      if (!item || !(await canUserViewAdminItemInCategory(user, file.surgeryId, item.categoryId))) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
    }

    const body = Buffer.from(file.data)
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': file.contentType,
        'Content-Length': String(body.byteLength),
        // File bytes are immutable per id (uploads are never mutated), so
        // long-lived private caching is safe.
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        // Inline lets the browser preview the PDF, but PDFs can embed
        // scripts — the CSP sandbox (no allow-* flags) blocks script
        // execution and keeps the document isolated from our origin.
        'Content-Disposition': `inline; filename="${safeFilename(file.filename)}"`,
        'Content-Security-Policy': 'sandbox',
      },
    })
  } catch (error) {
    console.error('Error serving admin toolkit file:', error)
    return NextResponse.json({ error: 'Failed to load file' }, { status: 500 })
  }
}
