import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { generateJSON } from '@tiptap/html'

export const runtime = 'nodejs'

const revertInstructionSchema = z.object({
  symptomId: z.string(),
  source: z.enum(['base', 'override', 'custom']),
})

export async function GET(request: NextRequest) {
  try {
    // Check authentication and superuser role
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.globalRole !== 'SUPERUSER') {
      return NextResponse.json({ error: 'Superuser access required' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const symptomId = searchParams.get('symptomId')
    const source = searchParams.get('source')

    if (!symptomId || !source) {
      return NextResponse.json({ error: 'symptomId and source are required' }, { status: 400 })
    }

    if (!['base', 'override', 'custom'].includes(source)) {
      return NextResponse.json({ error: 'Invalid source type' }, { status: 400 })
    }

    // Check if there's history to revert
    const latestHistory = await prisma.symptomHistory.findFirst({
      where: {
        symptomId,
        source: source as 'base' | 'override' | 'custom',
      },
      orderBy: {
        changedAt: 'desc',
      },
    })

    // Check if the history entry has valid data to revert to
    if (!latestHistory) {
      return NextResponse.json({ hasHistory: false })
    }

    // Verify that there's actual instruction data to revert to
    const historyRecord = latestHistory as typeof latestHistory & {
      previousBriefInstruction: string | null
      previousInstructionsHtml: string | null
    }
    const previousInstructionsHtml = historyRecord.previousInstructionsHtml || latestHistory.previousText

    const hasHistory = !!previousInstructionsHtml

    return NextResponse.json({ hasHistory })
  } catch (error) {
    console.error('Error checking revert history:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Check authentication and superuser role
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.globalRole !== 'SUPERUSER') {
      return NextResponse.json({ error: 'Superuser access required' }, { status: 403 })
    }

    // Parse and validate request body
    const body = await request.json()
    const { symptomId, source } = revertInstructionSchema.parse(body)

    // Find the most recent SymptomHistory entry for this symptom
    const latestHistory = await prisma.symptomHistory.findFirst({
      where: {
        symptomId,
        source,
      },
      orderBy: {
        changedAt: 'desc',
      },
    })

    if (!latestHistory) {
      return NextResponse.json({ error: 'No previous version available' }, { status: 400 })
    }

    // Extract the previous values from history
    // Type assertion needed due to Prisma client type generation timing
    const historyRecord = latestHistory as typeof latestHistory & {
      previousBriefInstruction: string | null
      newBriefInstruction: string | null
      previousInstructionsHtml: string | null
      newInstructionsHtml: string | null
    }
    const previousBriefInstruction = historyRecord.previousBriefInstruction
    const previousInstructionsHtml = historyRecord.previousInstructionsHtml || latestHistory.previousText

    if (!previousInstructionsHtml) {
      return NextResponse.json({ error: 'Previous version has no instruction data' }, { status: 400 })
    }

    // Get current values before reverting
    let currentBriefInstruction: string | null = null
    let currentInstructionsHtml: string | null = null

    // Fetch current symptom to capture "before" state for history
    if (source === 'base') {
      const symptom = await prisma.baseSymptom.findUnique({
        where: { id: symptomId },
        select: { briefInstruction: true, instructionsHtml: true },
      })

      if (!symptom) {
        return NextResponse.json({ error: 'Symptom not found' }, { status: 404 })
      }

      currentBriefInstruction = symptom.briefInstruction
      currentInstructionsHtml = symptom.instructionsHtml

      // Generate ProseMirror JSON from HTML
      const instructionsJson = generateJSON(previousInstructionsHtml, [
        StarterKit,
        TextStyle,
        Color.configure({
          types: ['textStyle'],
        }),
      ])

      // Update the symptom to revert values
      await prisma.baseSymptom.update({
        where: { id: symptomId },
        data: {
          briefInstruction: previousBriefInstruction || undefined,
          instructionsHtml: previousInstructionsHtml,
          instructionsJson: JSON.stringify(instructionsJson), // Store as string
          lastEditedBy: user.name || undefined,
          lastEditedAt: new Date(),
        },
      })
    } else if (source === 'custom') {
      const symptom = await prisma.surgeryCustomSymptom.findUnique({
        where: { id: symptomId },
        select: { briefInstruction: true, instructionsHtml: true },
      })

      if (!symptom) {
        return NextResponse.json({ error: 'Symptom not found' }, { status: 404 })
      }

      currentBriefInstruction = symptom.briefInstruction
      currentInstructionsHtml = symptom.instructionsHtml

      // Generate ProseMirror JSON from HTML
      const instructionsJson = generateJSON(previousInstructionsHtml, [
        StarterKit,
        TextStyle,
        Color.configure({
          types: ['textStyle'],
        }),
      ])

      // Update the symptom to revert values
      await prisma.surgeryCustomSymptom.update({
        where: { id: symptomId },
        data: {
          briefInstruction: previousBriefInstruction || undefined,
          instructionsHtml: previousInstructionsHtml,
          instructionsJson: JSON.stringify(instructionsJson), // Store as string
          lastEditedBy: user.name || undefined,
          lastEditedAt: new Date(),
        },
      })
    } else if (source === 'override') {
      return NextResponse.json({ error: 'Cannot revert override symptoms via this endpoint' }, { status: 400 })
    } else {
      return NextResponse.json({ error: 'Invalid source type' }, { status: 400 })
    }

    // Create a new history entry for the revert operation
    // Using any to bypass TypeScript issue - fields exist in database and schema
    await prisma.symptomHistory.create({
      data: {
        symptomId,
        source,
        previousText: currentInstructionsHtml || null, // Legacy field
        newText: previousInstructionsHtml || '', // Legacy field - ensure non-null
        previousBriefInstruction: currentBriefInstruction || null,
        newBriefInstruction: previousBriefInstruction || null,
        previousInstructionsHtml: currentInstructionsHtml || null,
        newInstructionsHtml: previousInstructionsHtml || null,
        editorName: user.name || undefined,
        editorEmail: user.email || undefined,
        modelUsed: 'REVERT',
      } as any,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error)
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }

    console.error('Error reverting instruction:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

