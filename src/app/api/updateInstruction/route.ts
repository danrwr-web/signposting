import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { getCachedSymptomsTag } from '@/server/effectiveSymptoms'
import { markSymptomPendingReview } from '@/server/clinicalReview'
import { sanitizeSymptomHtml } from '@/lib/sanitizeHtml'

export const runtime = 'nodejs'

const updateInstructionSchema = z.object({
  symptomId: z.string(),
  source: z.enum(['base', 'override', 'custom']),
  surgeryId: z.string().optional(),
  modelUsed: z.string().optional(),
  newBriefInstruction: z.string().optional(),
  newInstructionsHtml: z.string().optional(),
  newInstructionsJson: z.any().optional(),
})

export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const parsedBody = updateInstructionSchema.parse(body)
    const { symptomId, source, surgeryId, modelUsed, newBriefInstruction, newInstructionsJson } = parsedBody
    // Server-side sanitization: with <img> allowed, the internal-src-only
    // invariant must not rely on the client. Idempotent for well-formed input.
    const newInstructionsHtml =
      parsedBody.newInstructionsHtml !== undefined
        ? sanitizeSymptomHtml(parsedBody.newInstructionsHtml)
        : undefined

    // Ensure at least one field is being updated
    if (!newBriefInstruction && !newInstructionsHtml) {
      return NextResponse.json({ error: 'At least one of newBriefInstruction or newInstructionsHtml must be provided' }, { status: 400 })
    }

    const isSuperuser = user.globalRole === 'SUPERUSER'
    const isSurgeryAdmin =
      !!surgeryId && user.memberships.some(m => m.surgeryId === surgeryId && m.role === 'ADMIN')

    // Non-superusers can only apply changes within a surgery where they are an admin.
    if (!isSuperuser) {
      if (!surgeryId) {
        return NextResponse.json({ error: 'surgeryId is required' }, { status: 400 })
      }
      if (!isSurgeryAdmin) {
        return NextResponse.json(
          { error: 'Admin or Superuser required for this surgery' },
          { status: 403 }
        )
      }
    }

    // Override updates always target a specific surgery's override row.
    if (source === 'override' && !surgeryId) {
      return NextResponse.json({ error: 'surgeryId is required for override updates' }, { status: 400 })
    }

    // Fetch the current symptom based on source type
    let previousBriefInstruction: string | null = null
    let previousInstructionsHtml: string | null = null
    
    // Surgery admins never edit BaseSymptom directly. For base symptoms, write a surgery override instead.
    // Override updates land in the surgery's override row for superusers too — otherwise the write
    // would hit BaseSymptom and stay shadowed (invisible) behind the existing override.
    // (Superusers may still edit BaseSymptom globally when `source === 'base'`.)
    if (source === 'override' || (source === 'base' && !isSuperuser)) {
      // At this point, surgeryId is guaranteed (admins via the membership check, override updates
      // via the check above).
      const baseSymptom = await prisma.baseSymptom.findUnique({
        where: { id: symptomId },
        select: { id: true, ageGroup: true, briefInstruction: true, instructionsHtml: true, instructionsJson: true },
      })

      if (!baseSymptom) {
        return NextResponse.json({ error: 'Symptom not found' }, { status: 404 })
      }

      const existingOverride = await prisma.surgerySymptomOverride.findUnique({
        where: { surgeryId_baseSymptomId: { surgeryId: surgeryId!, baseSymptomId: symptomId } },
        select: { ageGroup: true, briefInstruction: true, instructionsHtml: true, instructionsJson: true },
      })

      previousBriefInstruction = existingOverride?.briefInstruction ?? baseSymptom.briefInstruction
      previousInstructionsHtml = existingOverride?.instructionsHtml ?? baseSymptom.instructionsHtml

      const nextBriefInstruction =
        newBriefInstruction !== undefined
          ? newBriefInstruction
          : (existingOverride?.briefInstruction ?? baseSymptom.briefInstruction)

      const nextInstructionsHtml =
        newInstructionsHtml !== undefined
          ? newInstructionsHtml
          : (existingOverride?.instructionsHtml ?? baseSymptom.instructionsHtml)

      const nextInstructionsJson =
        newInstructionsJson !== undefined
          ? (typeof newInstructionsJson === 'string' ? newInstructionsJson : JSON.stringify(newInstructionsJson))
          : (existingOverride?.instructionsJson ?? baseSymptom.instructionsJson)

      await prisma.$transaction(async (tx) => {
        await tx.surgerySymptomOverride.upsert({
          where: { surgeryId_baseSymptomId: { surgeryId: surgeryId!, baseSymptomId: symptomId } },
          create: {
            surgeryId: surgeryId!,
            baseSymptomId: symptomId,
            briefInstruction: nextBriefInstruction ?? undefined,
            instructions: nextInstructionsHtml ?? undefined, // Legacy field, kept in sync with HTML
            instructionsHtml: nextInstructionsHtml ?? undefined,
            instructionsJson: nextInstructionsJson ?? undefined,
            lastEditedBy: user.name || user.email,
            lastEditedAt: new Date(),
          },
          update: {
            briefInstruction: nextBriefInstruction ?? undefined,
            instructions: nextInstructionsHtml ?? undefined, // Legacy field, kept in sync with HTML
            instructionsHtml: nextInstructionsHtml ?? undefined,
            instructionsJson: nextInstructionsJson ?? undefined,
            lastEditedBy: user.name || user.email,
            lastEditedAt: new Date(),
          },
        })

        await tx.symptomHistory.create({
          data: {
            // For overrides, we record history against the base symptom id (see other override flows).
            symptomId,
            source: 'override',
            previousText: previousInstructionsHtml || null,
            newText: nextInstructionsHtml || previousInstructionsHtml || '',
            previousBriefInstruction: previousBriefInstruction || null,
            newBriefInstruction: nextBriefInstruction ?? previousBriefInstruction ?? null,
            previousInstructionsHtml: previousInstructionsHtml || null,
            newInstructionsHtml: nextInstructionsHtml ?? previousInstructionsHtml ?? null,
            editorName: user.name || undefined,
            editorEmail: user.email || undefined,
            modelUsed: modelUsed || 'unknown-model',
          } as any,
        })
      })

      // Practice content changed — the symptom must be clinically re-approved.
      // Review statuses are keyed by the effective age group: an override's
      // non-empty ageGroup wins over the base's (matching effectiveSymptoms).
      const effectiveAgeGroup =
        existingOverride?.ageGroup && existingOverride.ageGroup.trim() !== ''
          ? existingOverride.ageGroup
          : baseSymptom.ageGroup
      await markSymptomPendingReview(surgeryId!, symptomId, effectiveAgeGroup)

      // Without this the cached effective symptom lists keep showing the old
      // text for up to 5 minutes after the override is saved.
      revalidateTag(getCachedSymptomsTag(surgeryId!, false))
      revalidateTag(getCachedSymptomsTag(surgeryId!, true))
      revalidateTag('symptoms')

      return NextResponse.json({ ok: true })
    }

    if (source === 'base') {
      // Superusers edit BaseSymptom globally - this is the primary editable row for base symptoms
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
        instructions?: string
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
        updateData.instructions = newInstructionsHtml // Legacy field, kept in sync with HTML
        updateData.instructionsHtml = newInstructionsHtml
      }

      if (newInstructionsJson !== undefined) {
        // instructionsJson is stored as a string in the database
        updateData.instructionsJson = typeof newInstructionsJson === 'string'
          ? newInstructionsJson
          : JSON.stringify(newInstructionsJson)
      }

      if (user.name) {
        updateData.lastEditedBy = user.name
      }

      // Insert history record with both brief and full instructions
      // Using any to bypass TypeScript issue - fields exist in database and schema
      await prisma.symptomHistory.create({
        data: {
          symptomId,
          source,
          previousText: previousInstructionsHtml || null, // Legacy field for backward compatibility
          newText: newInstructionsHtml || previousInstructionsHtml || '', // Legacy field - ensure non-null
          previousBriefInstruction: previousBriefInstruction || null,
          newBriefInstruction: newBriefInstruction !== undefined ? newBriefInstruction : previousBriefInstruction || null,
          previousInstructionsHtml: previousInstructionsHtml || null,
          newInstructionsHtml: newInstructionsHtml !== undefined ? newInstructionsHtml : previousInstructionsHtml || null,
          editorName: user.name || undefined,
          editorEmail: user.email || undefined,
          modelUsed: modelUsed || 'unknown-model',
        } as any
      })

      // Update the symptom
      await prisma.baseSymptom.update({
        where: { id: symptomId },
        data: updateData
      })

      // Base symptom changes affect every surgery's effective list.
      revalidateTag('symptoms')
    } else if (source === 'custom') {
      // Superusers can edit any custom symptoms. Surgery admins can edit custom symptoms only within their surgery.
      const symptom = await prisma.surgeryCustomSymptom.findUnique({
        where: { id: symptomId },
        select: { briefInstruction: true, instructionsHtml: true, surgeryId: true, ageGroup: true }
      })
      
      if (!symptom) {
        return NextResponse.json({ error: 'Symptom not found' }, { status: 404 })
      }

      if (!isSuperuser) {
        // Enforce surgery scoping: an admin can only modify custom symptoms that belong to their surgery.
        if (!surgeryId || symptom.surgeryId !== surgeryId) {
          return NextResponse.json(
            { error: 'Admin or Superuser required for this surgery' },
            { status: 403 }
          )
        }
      }
      
      previousBriefInstruction = symptom.briefInstruction
      previousInstructionsHtml = symptom.instructionsHtml
      
      // Build update data - only include fields that are being changed
      const updateData: {
        briefInstruction?: string
        instructions?: string
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
        updateData.instructions = newInstructionsHtml // Legacy field, kept in sync with HTML
        updateData.instructionsHtml = newInstructionsHtml
      }

      if (newInstructionsJson !== undefined) {
        // instructionsJson is stored as a string in the database
        updateData.instructionsJson = typeof newInstructionsJson === 'string' 
          ? newInstructionsJson 
          : JSON.stringify(newInstructionsJson)
      }
      
      if (user.name) {
        updateData.lastEditedBy = user.name
      }
      
      // Insert history record with both brief and full instructions
      // Using any to bypass TypeScript issue - fields exist in database and schema
      await prisma.symptomHistory.create({
        data: {
          symptomId,
          source,
          previousText: previousInstructionsHtml || null, // Legacy field for backward compatibility
          newText: newInstructionsHtml || previousInstructionsHtml || '', // Legacy field - ensure non-null
          previousBriefInstruction: previousBriefInstruction || null,
          newBriefInstruction: newBriefInstruction !== undefined ? newBriefInstruction : previousBriefInstruction || null,
          previousInstructionsHtml: previousInstructionsHtml || null,
          newInstructionsHtml: newInstructionsHtml !== undefined ? newInstructionsHtml : previousInstructionsHtml || null,
          editorName: user.name || undefined,
          editorEmail: user.email || undefined,
          modelUsed: modelUsed || 'unknown-model',
        } as any
      })
      
      // Update the symptom
      await prisma.surgeryCustomSymptom.update({
        where: { id: symptomId },
        data: updateData
      })

      // Practice content changed — the symptom must be clinically re-approved.
      await markSymptomPendingReview(symptom.surgeryId, symptomId, symptom.ageGroup)

      revalidateTag(getCachedSymptomsTag(symptom.surgeryId, false))
      revalidateTag(getCachedSymptomsTag(symptom.surgeryId, true))
      revalidateTag('symptoms')
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

