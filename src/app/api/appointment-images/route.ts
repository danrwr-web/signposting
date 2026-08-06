import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { detectImageContentType } from '@/server/adminToolkitImages'
import { MAX_APPOINTMENT_IMAGE_BYTES } from '@/server/appointmentImages'

export const runtime = 'nodejs'

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

    let user
    try {
      user = await requireSurgeryAdmin(surgeryId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized'
      const status = message === 'Authentication required' ? 401 : 403
      return NextResponse.json({ error: message }, { status })
    }

    // itemId present → editing an existing appointment; it must belong to the
    // surgery the caller administers, or an admin of one surgery could bind
    // images to another surgery's appointment. Absent → create modal, where
    // the appointment doesn't exist yet and the row is claimed on save.
    if (itemId) {
      const appointment = await prisma.appointmentType.findFirst({
        where: { id: itemId, surgeryId },
        select: { id: true },
      })
      if (!appointment) {
        return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
      }
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'The file is empty.' }, { status: 400 })
    }
    if (file.size > MAX_APPOINTMENT_IMAGE_BYTES) {
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

    const image = await prisma.appointmentImage.create({
      data: {
        surgeryId,
        appointmentTypeId: itemId || null,
        contentType,
        data: Buffer.from(bytes),
        sizeBytes: bytes.byteLength,
        filename: (file.name || 'image').slice(0, 200),
        createdByUserId: user.id,
      },
      select: { id: true },
    })

    return NextResponse.json(
      { id: image.id, url: `/api/appointment-images/${image.id}` },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error uploading appointment image:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
