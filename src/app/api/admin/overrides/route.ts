import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')
    const baseId = searchParams.get('baseId')

    if (!surgeryId || !baseId) {
      return NextResponse.json(
        { error: 'surgeryId and baseId are required' },
        { status: 400 }
      )
    }

    // Check if user has access to this surgery
    await requireSurgeryAdmin(surgeryId)

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
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching override:', error)
    return NextResponse.json(
      { error: 'Failed to fetch override' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { surgeryId, baseId, ...overrideData } = body

    if (!surgeryId || !baseId) {
      return NextResponse.json(
        { error: 'surgeryId and baseId are required' },
        { status: 400 }
      )
    }

    // Check if user has access to this surgery
    await requireSurgeryAdmin(surgeryId)

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

    // Remove null/undefined values but keep empty strings (they represent "inherit from base")
    const cleanData = Object.fromEntries(
      Object.entries(overrideData).filter(([_, value]) => 
        value !== null && value !== undefined
      )
    )

    // Debug logging
    console.error('Override API received:', { surgeryId, baseId, overrideData, cleanData })

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
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error creating/updating override:', error)
    
    // Provide more specific error details
    let errorMessage = 'Failed to create/update override'
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`
    }
    
    return NextResponse.json(
      { error: errorMessage, details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')
    const baseId = searchParams.get('baseId')

    if (!surgeryId || !baseId) {
      return NextResponse.json(
        { error: 'surgeryId and baseId are required' },
        { status: 400 }
      )
    }

    // Check if user has access to this surgery
    await requireSurgeryAdmin(surgeryId)

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
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error deleting override:', error)
    return NextResponse.json(
      { error: 'Failed to delete override' },
      { status: 500 }
    )
  }
}
