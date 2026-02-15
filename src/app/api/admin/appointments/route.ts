import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'

const createAppointmentSchema = z.object({
  surgeryId: z.string(),
  name: z.string().min(1),
  staffType: z.string().optional(),
  durationMins: z.number().int().positive().optional().nullable(),
  colour: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isEnabled: z.boolean().optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validated = createAppointmentSchema.parse(body)
    
    // Check permissions
    const user = await requireSurgeryAdmin(validated.surgeryId)

    // Create appointment type
    const appointment = await prisma.appointmentType.create({
      data: {
        surgeryId: validated.surgeryId,
        name: validated.name,
        staffType: validated.staffType || null,
        durationMins: validated.durationMins ?? null,
        colour: validated.colour || null,
        notes: validated.notes || null,
        isEnabled: validated.isEnabled ?? true,
        lastEditedBy: user.email
      }
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

