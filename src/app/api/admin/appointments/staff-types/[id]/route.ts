import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { normalizeStaffLabel, StaffTypeResponse } from '@/lib/staffTypes'

export const runtime = 'nodejs'

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  defaultColour: z.string().min(1).optional().nullable(),
  isEnabled: z.boolean().optional(),
  orderIndex: z.number().int().nonnegative().optional()
})

function mapStaffType(record: any): StaffTypeResponse {
  return {
    id: record.id,
    label: record.label,
    normalizedLabel: record.normalizedLabel,
    defaultColour: record.defaultColour,
    isBuiltIn: record.isBuiltIn,
    isEnabled: record.isEnabled,
    orderIndex: record.orderIndex,
    surgeryId: record.surgeryId
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const parsed = updateSchema.parse(body)

    const existing = await prisma.appointmentStaffType.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Staff type not found' }, { status: 404 })
    }

    if (existing.isBuiltIn || !existing.surgeryId) {
      return NextResponse.json({ error: 'Built-in staff types cannot be modified' }, { status: 400 })
    }

    const adminUser = await requireSurgeryAdmin(existing.surgeryId)

    const data: any = {}
    let labelChanged = false

    if (parsed.label && parsed.label !== existing.label) {
      const normalizedLabel = normalizeStaffLabel(parsed.label)
      const collision = await prisma.appointmentStaffType.findFirst({
        where: {
          surgeryId: existing.surgeryId,
          normalizedLabel,
          NOT: { id }
        }
      })

      if (collision) {
        return NextResponse.json(
          { error: 'Another staff team already uses this name' },
          { status: 409 }
        )
      }

      data.label = parsed.label
      data.normalizedLabel = normalizedLabel
      labelChanged = true
    }

    if (parsed.defaultColour !== undefined) {
      data.defaultColour = parsed.defaultColour
    }

    if (parsed.isEnabled !== undefined) {
      data.isEnabled = parsed.isEnabled
    }

    if (parsed.orderIndex !== undefined) {
      data.orderIndex = parsed.orderIndex
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(mapStaffType(existing))
    }

    const updated = await prisma.appointmentStaffType.update({
      where: { id },
      data
    })

    if (labelChanged) {
      await prisma.appointmentType.updateMany({
        where: {
          surgeryId: existing.surgeryId,
          staffType: existing.label
        },
        data: {
          staffType: data.label
        }
      })
    }

    console.info('User %s updated staff type %s for surgery %s', adminUser.email, id, existing.surgeryId)

    return NextResponse.json(mapStaffType(updated))
  } catch (error) {
    console.error('Error updating staff type:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to update staff type' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const existing = await prisma.appointmentStaffType.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: 'Staff type not found' }, { status: 404 })
    }

    if (existing.isBuiltIn || !existing.surgeryId) {
      return NextResponse.json({ error: 'Built-in staff types cannot be deleted' }, { status: 400 })
    }

    await requireSurgeryAdmin(existing.surgeryId)

    await prisma.$transaction([
      prisma.appointmentType.updateMany({
        where: {
          surgeryId: existing.surgeryId,
          staffType: existing.label
        },
        data: {
          staffType: 'All'
        }
      }),
      prisma.appointmentStaffType.delete({ where: { id } })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting staff type:', error)
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to delete staff type' }, { status: 500 })
  }
}
