import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'

const updateAppointmentSchema = z.object({
  name: z.string().min(1).optional(),
  staffType: z.string().optional().nullable(),
  durationMins: z.number().int().positive().optional().nullable(),
  colour: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
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

    const body = await request.json()
    
    // Validate input
    const validated = updateAppointmentSchema.parse(body)

    // Build update data
    const updateData: any = {
      lastEditedBy: user.email,
      lastEditedAt: new Date()
    }

    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.staffType !== undefined) updateData.staffType = validated.staffType
    if (validated.durationMins !== undefined) updateData.durationMins = validated.durationMins
    if (validated.colour !== undefined) updateData.colour = validated.colour
    if (validated.notes !== undefined) updateData.notes = validated.notes
    if (validated.isEnabled !== undefined) updateData.isEnabled = validated.isEnabled

    // Update appointment type
    const appointment = await prisma.appointmentType.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(appointment)
  } catch (error) {
    console.error('Error updating appointment:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
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

