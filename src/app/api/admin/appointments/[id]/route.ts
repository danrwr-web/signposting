import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
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
