import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireAdminToolkitItemEdit,
  requireAdminToolkitWrite,
  type ActionError,
} from '@/server/adminToolkitGates'
import { detectImageContentType, MAX_ADMIN_TOOLKIT_IMAGE_BYTES } from '@/server/adminToolkitImages'

export const runtime = 'nodejs'

function gateErrorResponse(error: ActionError): NextResponse {
  const status =
    error.code === 'UNAUTHENTICATED' ? 401 : error.code === 'NOT_FOUND' ? 404 : 403
  return NextResponse.json({ error: error.message }, { status })
}

export async function POST(request: NextRequest) {
  try {
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 })
    }

    const file = form.get('file')
    const surgeryId = form.get('surgeryId')
    const itemId = form.get('itemId')

    if (!(file instanceof File) || typeof surgeryId !== 'string' || !surgeryId) {
      return NextResponse.json({ error: 'Missing file or surgeryId' }, { status: 400 })
    }
    if (itemId !== null && (typeof itemId !== 'string' || !itemId)) {
      return NextResponse.json({ error: 'Invalid itemId' }, { status: 400 })
    }

    // itemId present → per-item edit gate (covers staff editors with grants);
    // absent → admin create form, where the item doesn't exist yet.
    const gate = itemId
      ? await requireAdminToolkitItemEdit(surgeryId, itemId)
      : await requireAdminToolkitWrite(surgeryId)
    if (!gate.ok) {
      return gateErrorResponse(gate.error)
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'The file is empty.' }, { status: 400 })
    }
    if (file.size > MAX_ADMIN_TOOLKIT_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image must be 2MB or smaller.' }, { status: 413 })
    }
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      return NextResponse.json({ error: 'Only JPG and PNG images are supported.' }, { status: 415 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const contentType = detectImageContentType(bytes)
    if (!contentType) {
      return NextResponse.json(
        { error: 'The file does not look like a JPG or PNG image.' },
        { status: 415 },
      )
    }

    const image = await prisma.adminItemImage.create({
      data: {
        surgeryId,
        adminItemId: itemId || null,
        contentType,
        data: Buffer.from(bytes),
        sizeBytes: bytes.byteLength,
        filename: (file.name || 'image').slice(0, 200),
        createdByUserId: gate.data.userId,
      },
      select: { id: true },
    })

    return NextResponse.json(
      { id: image.id, url: `/api/admin-toolkit/images/${image.id}` },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error uploading admin toolkit image:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
