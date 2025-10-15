import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')
    const baseId = searchParams.get('baseId')

    if (!surgeryId || !baseId) {
      return NextResponse.json(
        { error: 'surgeryId and baseId are required' },
        { status: 400 }
      )
    }

    // Verify surgery access
    if (session.type === 'surgery' && session.surgeryId !== surgeryId) {
      return NextResponse.json(
        { error: 'Access denied to this surgery' },
        { status: 403 }
      )
    }

    const override = await prisma.surgerySymptomOverride.findUnique({
      where: {
        surgeryId_baseSymptomId: {
          surgeryId,
          baseSymptomId: baseId,
        }
      },
      include: {
        baseSymptom: true,
        surgery: true,
      }
    })

    return NextResponse.json(override)
  } catch (error) {
    console.error('Error fetching override:', error)
    return NextResponse.json(
      { error: 'Failed to fetch override' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    
    // Only surgery admins can create overrides
    if (session.type !== 'surgery' || !session.surgeryId) {
      return NextResponse.json(
        { error: 'Only surgery admins can create overrides' },
        { status: 403 }
      )
    }
    
    const body = await request.json()
    const { surgeryId, baseId, ...overrideData } = body

    if (!surgeryId || !baseId) {
      return NextResponse.json(
        { error: 'surgeryId and baseId are required' },
        { status: 400 }
      )
    }

    // Validate that the surgery exists
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId }
    })
    if (!surgery) {
      return NextResponse.json(
        { error: 'Surgery not found' },
        { status: 404 }
      )
    }

    // Validate that the base symptom exists
    const baseSymptom = await prisma.baseSymptom.findUnique({
      where: { id: baseId }
    })
    if (!baseSymptom) {
      return NextResponse.json(
        { error: 'Base symptom not found' },
        { status: 404 }
      )
    }

    // Verify surgery access
    if (session.surgeryId !== surgeryId) {
      return NextResponse.json(
        { error: 'Access denied to this surgery' },
        { status: 403 }
      )
    }

    // Remove null/undefined values but keep empty strings (they represent "inherit from base")
    const cleanData = Object.fromEntries(
      Object.entries(overrideData).filter(([_, value]) => 
        value !== null && value !== undefined
      )
    )

    const override = await prisma.surgerySymptomOverride.upsert({
      where: {
        surgeryId_baseSymptomId: {
          surgeryId,
          baseSymptomId: baseId,
        }
      },
      update: cleanData,
      create: {
        surgeryId,
        baseSymptomId: baseId,
        ...cleanData,
      },
      include: {
        baseSymptom: true,
        surgery: true,
      }
    })

    return NextResponse.json(override)
  } catch (error) {
    console.error('Error creating/updating override:', error)
    return NextResponse.json(
      { error: 'Failed to create/update override', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth()
    
    // Only surgery admins can delete overrides
    if (session.type !== 'surgery' || !session.surgeryId) {
      return NextResponse.json(
        { error: 'Only surgery admins can delete overrides' },
        { status: 403 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')
    const baseId = searchParams.get('baseId')

    if (!surgeryId || !baseId) {
      return NextResponse.json(
        { error: 'surgeryId and baseId are required' },
        { status: 400 }
      )
    }

    // Verify surgery access
    if (session.surgeryId !== surgeryId) {
      return NextResponse.json(
        { error: 'Access denied to this surgery' },
        { status: 403 }
      )
    }

    await prisma.surgerySymptomOverride.delete({
      where: {
        surgeryId_baseSymptomId: {
          surgeryId,
          baseSymptomId: baseId,
        }
      }
    })

    return NextResponse.json({ message: 'Override deleted successfully' })
  } catch (error) {
    console.error('Error deleting override:', error)
    return NextResponse.json(
      { error: 'Failed to delete override' },
      { status: 500 }
    )
  }
}
