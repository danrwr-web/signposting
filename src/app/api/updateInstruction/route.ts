import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'

const updateInstructionSchema = z.object({
  symptomId: z.string(),
  source: z.enum(['base', 'override', 'custom']),
  modelUsed: z.string().optional(),
  newBriefInstruction: z.string().optional(),
  newInstructionsHtml: z.string().optional(),
  newInstructionsJson: z.any().optional(),
})

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
    console.log('Update instruction request body:', { 
      ...body, 
      newInstructionsHtml: body.newInstructionsHtml?.substring(0, 100) + '...' 
    })
    const { symptomId, source, modelUsed, newBriefInstruction, newInstructionsHtml, newInstructionsJson } = updateInstructionSchema.parse(body)

    // Ensure at least one field is being updated
    if (!newBriefInstruction && !newInstructionsHtml) {
      return NextResponse.json({ error: 'At least one of newBriefInstruction or newInstructionsHtml must be provided' }, { status: 400 })
    }

    // Fetch the current symptom based on source type
    let previousBriefInstruction: string | null = null
    let previousInstructionsHtml: string | null = null
    
    if (source === 'base') {
      // Superusers edit BaseSymptom - this is the primary editable row for base symptoms
      const symptom = await prisma.baseSymptom.findUnique({
        where: { id: symptomId },
        select: { briefInstruction: true, instructionsHtml: true }
      })
      
      if (!symptom) {
        return NextResponse.json({ error: 'Symptom not found' }, { status: 404 })
      }
      
      previousBriefInstruction = symptom.briefInstruction
      previousInstructionsHtml = symptom.instructionsHtml
      
      // Build update data - only include fields that are being changed
      const updateData: {
        briefInstruction?: string
        instructionsHtml?: string
        instructionsJson?: any
        lastEditedBy?: string
        lastEditedAt: Date
      } = {
        lastEditedAt: new Date(),
      }
      
      if (newBriefInstruction !== undefined) {
        updateData.briefInstruction = newBriefInstruction
      }
      
      if (newInstructionsHtml !== undefined) {
        updateData.instructionsHtml = newInstructionsHtml
      }
      
      if (newInstructionsJson !== undefined) {
        updateData.instructionsJson = newInstructionsJson
      }
      
      if (user.name) {
        updateData.lastEditedBy = user.name
      }
      
      // Insert history record with both brief and full instructions
      await prisma.symptomHistory.create({
        data: {
          symptomId,
          source,
          previousText: previousInstructionsHtml, // Legacy field for backward compatibility
          newText: newInstructionsHtml || previousInstructionsHtml, // Legacy field
          previousBriefInstruction: previousBriefInstruction,
          newBriefInstruction: newBriefInstruction !== undefined ? newBriefInstruction : previousBriefInstruction,
          previousInstructionsHtml: previousInstructionsHtml,
          newInstructionsHtml: newInstructionsHtml !== undefined ? newInstructionsHtml : previousInstructionsHtml,
          editorName: user.name || undefined,
          editorEmail: user.email || undefined,
          modelUsed: modelUsed || 'unknown-model',
        }
      })
      
      // Update the symptom
      await prisma.baseSymptom.update({
        where: { id: symptomId },
        data: updateData
      })
    } else if (source === 'custom') {
      // Superusers can edit custom symptoms created by surgeries
      const symptom = await prisma.surgeryCustomSymptom.findUnique({
        where: { id: symptomId },
        select: { briefInstruction: true, instructionsHtml: true }
      })
      
      if (!symptom) {
        return NextResponse.json({ error: 'Symptom not found' }, { status: 404 })
      }
      
      previousBriefInstruction = symptom.briefInstruction
      previousInstructionsHtml = symptom.instructionsHtml
      
      // Build update data - only include fields that are being changed
      const updateData: {
        briefInstruction?: string
        instructionsHtml?: string
        instructionsJson?: any
        lastEditedBy?: string
        lastEditedAt: Date
      } = {
        lastEditedAt: new Date(),
      }
      
      if (newBriefInstruction !== undefined) {
        updateData.briefInstruction = newBriefInstruction
      }
      
      if (newInstructionsHtml !== undefined) {
        updateData.instructionsHtml = newInstructionsHtml
      }
      
      if (newInstructionsJson !== undefined) {
        updateData.instructionsJson = newInstructionsJson
      }
      
      if (user.name) {
        updateData.lastEditedBy = user.name
      }
      
      // Insert history record with both brief and full instructions
      await prisma.symptomHistory.create({
        data: {
          symptomId,
          source,
          previousText: previousInstructionsHtml, // Legacy field for backward compatibility
          newText: newInstructionsHtml || previousInstructionsHtml, // Legacy field
          previousBriefInstruction: previousBriefInstruction,
          newBriefInstruction: newBriefInstruction !== undefined ? newBriefInstruction : previousBriefInstruction,
          previousInstructionsHtml: previousInstructionsHtml,
          newInstructionsHtml: newInstructionsHtml !== undefined ? newInstructionsHtml : previousInstructionsHtml,
          editorName: user.name || undefined,
          editorEmail: user.email || undefined,
          modelUsed: modelUsed || 'unknown-model',
        }
      })
      
      // Update the symptom
      await prisma.surgeryCustomSymptom.update({
        where: { id: symptomId },
        data: updateData
      })
    } else if (source === 'override') {
      // Overrides are surgery-specific customizations - not directly editable by superusers in this flow
      // They would need to edit the base symptom instead
      return NextResponse.json({ error: 'Cannot edit override symptoms via this endpoint' }, { status: 400 })
    } else {
      return NextResponse.json({ error: 'Invalid source type' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error)
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    
    console.error('Error updating instruction:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

