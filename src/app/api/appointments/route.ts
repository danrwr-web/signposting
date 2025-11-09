import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getSessionUser, requireSurgeryAccess } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')
    const q = searchParams.get('q') || ''

    if (!surgeryId) {
      return NextResponse.json(
        { error: 'surgeryId parameter required' },
        { status: 400 }
      )
    }

    // Verify user has access to this surgery
    await requireSurgeryAccess(surgeryId)

    // Build where clause
    const where: Prisma.AppointmentTypeWhereInput = {
      surgeryId,
      isEnabled: true
    }

    if (q) {
      where.name = {
        contains: q,
        mode: 'insensitive'
      }
    }

    const appointments = await prisma.appointmentType.findMany({
      where,
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(appointments)
  } catch (error) {
    console.error('Error fetching appointments:', error)
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to fetch appointments' },
      { status: 500 }
    )
  }
}

