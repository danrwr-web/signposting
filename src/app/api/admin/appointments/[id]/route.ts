import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { sanitizeAppointmentHtml, stripHtmlToPlainText } from '@/lib/sanitizeHtml'
import { isHtmlEmpty } from '@/lib/adminToolkitContentBlocksShared'
import { extractAppointmentImageIds } from '@/lib/appointmentUploads'
import { z } from 'zod'

export const runtime = 'nodejs'

const updateAppointmentSchema = z.object({
  name: z.string().min(1).optional(),
  staffType: z.string().optional().nullable(),
  durationMins: z.number().int().positive().optional().nullable(),
  colour: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  notesHtml: z.string().optional().nullable(),
  isEnabled: z.boolean().optional()
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Get existing appointment to check surgeryId
    const existing = await prisma.appointmentType.findUnique({
      where: { id },
      select: { surgeryId: true }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }

    if (!existing.surgeryId) {
      return NextResponse.json(
        { error: 'Cannot update appointment without surgeryId' },
        { status: 400 }
      )
    }

    // Check permissions
    const user = await requireSurgeryAdmin(existing.surgeryId)

    const body = (await request.json()) as unknown
    
    // Validate input
    const validated = updateAppointmentSchema.parse(body)

    // Build update data
    const updateData: Prisma.AppointmentTypeUpdateInput = {
      lastEditedBy: user.email,
      lastEditedAt: new Date()
    }

    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.staffType !== undefined) updateData.staffType = validated.staffType
    if (validated.durationMins !== undefined) updateData.durationMins = validated.durationMins
    if (validated.colour !== undefined) updateData.colour = validated.colour
    if (validated.isEnabled !== undefined) updateData.isEnabled = validated.isEnabled

    // notesHtml is canonical: when sent, plain notes is derived from it so
    // the text search filter keeps working. A legacy notes-only payload
    // clears notesHtml so stale rich content can't shadow the update.
    let imageIds: string[] = []
    if (validated.notesHtml !== undefined) {
      const sanitized = validated.notesHtml ? sanitizeAppointmentHtml(validated.notesHtml) : null
      const notesHtml = sanitized && !isHtmlEmpty(sanitized) ? sanitized : null
      updateData.notesHtml = notesHtml
      updateData.notes = notesHtml ? stripHtmlToPlainText(notesHtml) || null : null
      imageIds = extractAppointmentImageIds(notesHtml)
    } else if (validated.notes !== undefined) {
      updateData.notes = validated.notes
      updateData.notesHtml = null
    }

    // Update, then claim still-unowned images the notes reference (uploaded
    // from the create modal before the row existed). Rows already owned by an
    // appointment are never re-bound.
    const appointment = await prisma.$transaction(async (tx) => {
      const updated = await tx.appointmentType.update({
        where: { id },
        data: updateData
      })

      if (imageIds.length > 0 && existing.surgeryId) {
        await tx.appointmentImage.updateMany({
          where: { id: { in: imageIds }, surgeryId: existing.surgeryId, appointmentTypeId: null },
          data: { appointmentTypeId: id }
        })
      }

      return updated
    })

    return NextResponse.json(appointment)
  } catch (error) {
    console.error('Error updating appointment:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }
    
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update appointment' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Get existing appointment to check surgeryId
    const existing = await prisma.appointmentType.findUnique({
      where: { id },
      select: { surgeryId: true }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Appointment not found' },
        { status: 404 }
      )
    }

    if (!existing.surgeryId) {
      return NextResponse.json(
        { error: 'Cannot delete appointment without surgeryId' },
        { status: 400 }
      )
    }

    // Check permissions - user must be surgery admin or superuser
    const user = await requireSurgeryAdmin(existing.surgeryId)

    // Delete appointment
    await prisma.appointmentType.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting appointment:', error)
    
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to delete appointment' },
      { status: 500 }
    )
  }
}
