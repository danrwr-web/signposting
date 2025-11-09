import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess } from '@/lib/rbac'
import { StaffTypeResponse } from '@/lib/staffTypes'

export const runtime = 'nodejs'

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

    await requireSurgeryAccess(surgeryId)

    const staffTypes = await prisma.appointmentStaffType.findMany({
      where: {
        OR: [
          { surgeryId },
          { surgeryId: null }
        ],
        isEnabled: true
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
