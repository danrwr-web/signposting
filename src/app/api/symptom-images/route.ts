import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAdmin, requireSuperuser } from '@/lib/rbac'
import { detectImageContentType } from '@/server/adminToolkitImages'
import { MAX_SYMPTOM_IMAGE_BYTES } from '@/server/symptomImages'

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

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    if (surgeryId !== null && (typeof surgeryId !== 'string' || !surgeryId)) {
      return NextResponse.json({ error: 'Invalid surgeryId' }, { status: 400 })
    }

    // The gate mirrors who can edit the content the image will live in:
    // surgeryId present → surgery admin uploading for their override/custom
    // symptom; absent → superuser uploading for base-symptom content, stored
    // as a global image every surgery can view.
    let user
    try {
      user = surgeryId ? await requireSurgeryAdmin(surgeryId) : await requireSuperuser()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized'
      const status = message === 'Authentication required' ? 401 : 403
      return NextResponse.json({ error: message }, { status })
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'The file is empty.' }, { status: 400 })
    }
    if (file.size > MAX_SYMPTOM_IMAGE_BYTES) {
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

    const image = await prisma.symptomImage.create({
      data: {
        surgeryId: surgeryId || null,
        contentType,
        data: Buffer.from(bytes),
        sizeBytes: bytes.byteLength,
        filename: (file.name || 'image').slice(0, 200),
        createdByUserId: user.id,
      },
      select: { id: true },
    })

    return NextResponse.json(
      { id: image.id, url: `/api/symptom-images/${image.id}` },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error uploading symptom image:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
