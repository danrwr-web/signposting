import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireAdminToolkitItemEdit,
  requireAdminToolkitWrite,
  type ActionError,
} from '@/server/adminToolkitGates'
import { detectPdfContentType, MAX_ADMIN_TOOLKIT_FILE_BYTES } from '@/server/adminToolkitFiles'

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
    if (file.size > MAX_ADMIN_TOOLKIT_FILE_BYTES) {
      return NextResponse.json({ error: 'PDF must be 4MB or smaller.' }, { status: 413 })
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF documents are supported.' }, { status: 415 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const contentType = detectPdfContentType(bytes)
    if (!contentType) {
      return NextResponse.json(
        { error: 'The file does not look like a PDF document.' },
        { status: 415 },
      )
    }

    const created = await prisma.adminItemFile.create({
      data: {
        surgeryId,
        adminItemId: itemId || null,
        contentType,
        data: Buffer.from(bytes),
        sizeBytes: bytes.byteLength,
        filename: (file.name || 'document.pdf').slice(0, 200),
        createdByUserId: gate.data.userId,
      },
      select: { id: true },
    })

    return NextResponse.json(
      { id: created.id, url: `/api/admin-toolkit/files/${created.id}` },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error uploading admin toolkit file:', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
