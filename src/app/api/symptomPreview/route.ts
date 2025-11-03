import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

interface SymptomPreviewResponse {
  name: string
  status: 'BASE' | 'MODIFIED' | 'LOCAL_ONLY'
  isEnabled: boolean
  canEnable: boolean
  lastEditedBy?: string | null
  lastEditedAt?: string | null
  briefInstruction?: string | null
  instructionsHtml?: string | null
  baseInstructionsHtml?: string | null
}

// GET - Fetch symptom preview data
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // TODO: allow PRACTICE ADMIN for their own surgery only
    // For now, require SUPERUSER only
    if (user.globalRole !== 'SUPERUSER') {
      return NextResponse.json(
        { error: 'Superuser access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')
    const baseSymptomId = searchParams.get('baseSymptomId')
    const customSymptomId = searchParams.get('customSymptomId')

    if (!surgeryId) {
      return NextResponse.json(
        { error: 'surgeryId is required' },
        { status: 400 }
      )
    }

    if (!baseSymptomId && !customSymptomId) {
      return NextResponse.json(
        { error: 'Either baseSymptomId or customSymptomId is required' },
        { status: 400 }
      )
    }

    if (baseSymptomId && customSymptomId) {
      return NextResponse.json(
        { error: 'Only one of baseSymptomId or customSymptomId should be provided' },
        { status: 400 }
      )
    }

    let response: SymptomPreviewResponse

    // Handle base symptom
    if (baseSymptomId) {
      // Get the base symptom
      const baseSymptom = await prisma.baseSymptom.findUnique({
        where: { id: baseSymptomId },
        select: {
          id: true,
          name: true,
          briefInstruction: true,
          instructionsHtml: true
        }
      })

      if (!baseSymptom) {
        return NextResponse.json(
          { error: 'Base symptom not found' },
          { status: 404 }
        )
      }

      // Check for override
      const override = await prisma.surgerySymptomOverride.findUnique({
        where: {
          surgeryId_baseSymptomId: {
            surgeryId,
            baseSymptomId
          }
        },
        select: {
          briefInstruction: true,
          instructionsHtml: true
        }
      })

      // Get status row
      const statusRow = await prisma.surgerySymptomStatus.findFirst({
        where: {
          surgeryId,
          baseSymptomId
        },
        select: {
          isEnabled: true,
          lastEditedBy: true,
          lastEditedAt: true
        }
      })

      // Determine status and instructions
      const hasOverride = !!override
      const isEnabled = statusRow?.isEnabled ?? false
      
      // Get effective instructions (local if override exists, otherwise base)
      const effectiveBriefInstruction = hasOverride && override.briefInstruction?.trim()
        ? override.briefInstruction
        : baseSymptom.briefInstruction
      
      const effectiveInstructionsHtml = hasOverride && override.instructionsHtml?.trim()
        ? override.instructionsHtml
        : baseSymptom.instructionsHtml

      response = {
        name: baseSymptom.name,
        status: hasOverride ? 'MODIFIED' : 'BASE',
        isEnabled,
        canEnable: true, // Can always enable a base symptom
        lastEditedBy: statusRow?.lastEditedBy,
        lastEditedAt: statusRow?.lastEditedAt?.toISOString(),
        briefInstruction: effectiveBriefInstruction,
        instructionsHtml: effectiveInstructionsHtml,
        baseInstructionsHtml: hasOverride ? baseSymptom.instructionsHtml : undefined
      }
    }
    // Handle custom symptom
    else if (customSymptomId) {
      const customSymptom = await prisma.surgeryCustomSymptom.findFirst({
        where: {
          id: customSymptomId,
          surgeryId
        },
        select: {
          id: true,
          name: true,
          briefInstruction: true,
          instructionsHtml: true
        }
      })

      if (!customSymptom) {
        return NextResponse.json(
          { error: 'Custom symptom not found' },
          { status: 404 }
        )
      }

      // Get status row
      const statusRow = await prisma.surgerySymptomStatus.findFirst({
        where: {
          surgeryId,
          customSymptomId
        },
        select: {
          isEnabled: true,
          lastEditedBy: true,
          lastEditedAt: true
        }
      })

      const isEnabled = statusRow?.isEnabled ?? false

      response = {
        name: customSymptom.name,
        status: 'LOCAL_ONLY',
        isEnabled,
        canEnable: true, // Can always enable a custom symptom
        lastEditedBy: statusRow?.lastEditedBy,
        lastEditedAt: statusRow?.lastEditedAt?.toISOString(),
        briefInstruction: customSymptom.briefInstruction,
        instructionsHtml: customSymptom.instructionsHtml,
        baseInstructionsHtml: undefined
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      )
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching symptom preview:', error)
    return NextResponse.json(
      { error: 'Failed to fetch symptom preview' },
      { status: 500 }
    )
  }
}
