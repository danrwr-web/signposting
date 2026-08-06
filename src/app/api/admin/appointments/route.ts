import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { sanitizeAppointmentHtml, stripHtmlToPlainText } from '@/lib/sanitizeHtml'
import { isHtmlEmpty } from '@/lib/adminToolkitContentBlocksShared'
import { extractAppointmentImageIds } from '@/lib/appointmentUploads'
import { z } from 'zod'

export const runtime = 'nodejs'

const createAppointmentSchema = z.object({
  surgeryId: z.string(),
  name: z.string().min(1),
  staffType: z.string().optional(),
  durationMins: z.number().int().positive().optional().nullable(),
  colour: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  notesHtml: z.string().optional().nullable(),
  isEnabled: z.boolean().optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validated = createAppointmentSchema.parse(body)

    // Check permissions
    const user = await requireSurgeryAdmin(validated.surgeryId)

    // notesHtml is canonical; plain notes is derived from it so the text
    // search filter keeps working. Legacy callers (CSV import, older API
    // consumers) may still send plain notes without notesHtml.
    const sanitized = validated.notesHtml ? sanitizeAppointmentHtml(validated.notesHtml) : null
    const notesHtml = sanitized && !isHtmlEmpty(sanitized) ? sanitized : null
    const notes = notesHtml
      ? stripHtmlToPlainText(notesHtml) || null
      : validated.notes || null

    const imageIds = extractAppointmentImageIds(notesHtml)

    // Create appointment type, then claim still-unowned images its notes
    // reference (uploaded from the create modal before the row existed) so
    // they cascade with the appointment. Rows already owned are never re-bound.
    const appointment = await prisma.$transaction(async (tx) => {
      const created = await tx.appointmentType.create({
        data: {
          surgeryId: validated.surgeryId,
          name: validated.name,
          staffType: validated.staffType || null,
          durationMins: validated.durationMins ?? null,
          colour: validated.colour || null,
          notes,
          notesHtml,
          isEnabled: validated.isEnabled ?? true,
          lastEditedBy: user.email
        }
      })

      if (imageIds.length > 0) {
        await tx.appointmentImage.updateMany({
          where: { id: { in: imageIds }, surgeryId: validated.surgeryId, appointmentTypeId: null },
          data: { appointmentTypeId: created.id }
        })
      }

      return created
    })

    return NextResponse.json(appointment, { status: 201 })
  } catch (error) {
    console.error('Error creating appointment:', error)

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
      { error: 'Failed to create appointment' },
      { status: 500 }
    )
  }
}
