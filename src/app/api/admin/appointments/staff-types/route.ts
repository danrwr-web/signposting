import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { normalizeStaffLabel, StaffTypeResponse } from '@/lib/staffTypes'

export const runtime = 'nodejs'

const createStaffTypeSchema = z.object({
  surgeryId: z.string(),
  label: z.string().min(1),
  defaultColour: z.string().min(1).optional().nullable(),
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')

    if (!surgeryId) {
      return NextResponse.json({ error: 'surgeryId parameter required' }, { status: 400 })
    }

    await requireSurgeryAdmin(surgeryId)

    const staffTypes = await prisma.appointmentStaffType.findMany({
      where: {
        OR: [
          { surgeryId },
          { surgeryId: null }
        ]
      },
      orderBy: [
        { orderIndex: 'asc' },
        { label: 'asc' }
      ]
    })

    return NextResponse.json({ staffTypes: staffTypes.map(mapStaffType) })
  } catch (error) {
    console.error('Error fetching staff types:', error)
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to fetch staff types' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createStaffTypeSchema.parse(body)

    const adminUser = await requireSurgeryAdmin(parsed.surgeryId)

    const normalizedLabel = normalizeStaffLabel(parsed.label)

    const existing = await prisma.appointmentStaffType.findFirst({
      where: {
        surgeryId: parsed.surgeryId,
        normalizedLabel
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A staff team with this name already exists for the surgery' },
        { status: 409 }
      )
    }

    const orderIndex = parsed.orderIndex ?? (await prisma.appointmentStaffType.count({
      where: { surgeryId: parsed.surgeryId }
    })) + 100

    const staffType = await prisma.appointmentStaffType.create({
      data: {
        surgeryId: parsed.surgeryId,
        label: parsed.label,
        normalizedLabel,
        defaultColour: parsed.defaultColour ?? null,
        orderIndex,
        isBuiltIn: false,
        isEnabled: true
      }
    })

    console.info('User %s created staff type %s for surgery %s', adminUser.email, parsed.label, parsed.surgeryId)

    return NextResponse.json(mapStaffType(staffType), { status: 201 })
  } catch (error) {
    console.error('Error creating staff type:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to create staff type' }, { status: 500 })
  }
}
