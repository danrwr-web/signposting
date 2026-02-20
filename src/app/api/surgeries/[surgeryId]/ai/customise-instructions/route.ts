import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { CustomiseInstructionsReqZ } from '@/lib/api-contracts'
import { customiseInstructions } from '@/server/aiCustomiseInstructions'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { z } from 'zod'

export const runtime = 'nodejs'

// POST /api/surgeries/[surgeryId]/ai/customise-instructions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ surgeryId: string }> }
) {
  try {
    const { surgeryId } = await params

    // RBAC: Must be superuser or surgery admin
    const user = await requireSurgeryAdmin(surgeryId)

    // Verify surgery exists
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      include: {
        onboardingProfile: true,
        surgeryFeatureFlags: {
          include: {
            feature: true,
          },
        },
      },
    })

    if (!surgery) {
      return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
    }

    // Check feature flag is enabled
    const featureFlag = surgery.surgeryFeatureFlags.find(
      (f) => f.feature.key === 'ai_surgery_customisation' && f.enabled
    )

    if (!featureFlag) {
      return NextResponse.json(
        {
          error: 'AI customisation feature is not enabled for this surgery',
        },
        { status: 403 }
      )
    }

    // Check onboarding profile is completed
    if (!surgery.onboardingProfile || !surgery.onboardingProfile.completed) {
      return NextResponse.json(
        {
          error: 'Onboarding profile must be completed before using AI customisation',
        },
        { status: 400 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const { scope, symptomIds } = CustomiseInstructionsReqZ.parse(body)

    // Determine which symptoms to process
    let symptomsToProcess: Array<{ id: string; baseSymptomId?: string; customSymptomId?: string }> = []

    if (scope === 'all') {
      // Get all effective symptoms for this surgery
      const effectiveSymptoms = await getEffectiveSymptoms(surgeryId, false)
      symptomsToProcess = effectiveSymptoms
        .filter((s) => s.source === 'base' || s.source === 'custom')
        .map((s) => {
          // For base symptoms (including overrides), use the base symptom ID
          // For custom symptoms, use the custom symptom ID
          if (s.source === 'base') {
            return {
              id: s.baseSymptomId || s.id,
              baseSymptomId: s.baseSymptomId || s.id,
            }
          } else {
            return {
              id: s.id,
              customSymptomId: s.id,
            }
          }
        })
    } else if (scope === 'core') {
      // For "core", we'll use a heuristic: symptoms that are enabled and commonly used
      // For now, we'll use all enabled symptoms as "core"
      // This can be refined later with engagement data or a curated list
      const effectiveSymptoms = await getEffectiveSymptoms(surgeryId, false)
      symptomsToProcess = effectiveSymptoms
        .filter((s) => s.source === 'base' || s.source === 'custom')
        .map((s) => {
          if (s.source === 'base') {
            return {
              id: s.baseSymptomId || s.id,
              baseSymptomId: s.baseSymptomId || s.id,
            }
          } else {
            return {
              id: s.id,
              customSymptomId: s.id,
            }
          }
        })
    } else if (scope === 'manual') {
      // Process only the specified symptom IDs
      if (!symptomIds || symptomIds.length === 0) {
        return NextResponse.json(
          { error: 'symptomIds is required when scope is "manual"' },
          { status: 400 }
        )
      }

      // Fetch symptoms by ID (could be base or custom)
      const baseSymptoms = await prisma.baseSymptom.findMany({
        where: {
          id: { in: symptomIds },
          isDeleted: false,
        },
        select: { id: true },
      })

      const customSymptoms = await prisma.surgeryCustomSymptom.findMany({
        where: {
          id: { in: symptomIds },
          surgeryId,
          isDeleted: false,
        },
        select: { id: true },
      })

      console.log(`[AI Customisation] Manual scope: Found ${baseSymptoms.length} base symptoms and ${customSymptoms.length} custom symptoms from ${symptomIds.length} requested IDs`)

      symptomsToProcess = [
        ...baseSymptoms.map((s) => ({ id: s.id, baseSymptomId: s.id })),
        ...customSymptoms.map((s) => ({ id: s.id, customSymptomId: s.id })),
      ]

      if (symptomsToProcess.length === 0) {
        console.warn(`[AI Customisation] No symptoms found for IDs: ${symptomIds.join(', ')}`)
      }
    }

    // Process each symptom
    let processedCount = 0
    let skippedCount = 0
    const skippedDetails: Array<{ symptomId: string; reason?: string }> = []

    console.log(`[AI Customisation] Starting to process ${symptomsToProcess.length} symptom(s)`)

    for (const symptomRef of symptomsToProcess) {
      console.log(`[AI Customisation] Processing symptom ${symptomRef.id} (baseSymptomId: ${symptomRef.baseSymptomId}, customSymptomId: ${symptomRef.customSymptomId})`)
      try {
        // Fetch base symptom data (or custom symptom)
        let baseSymptomData: {
          name: string
          ageGroup: string
          briefInstruction: string | null
          instructionsHtml: string | null
        } | null = null

        if (symptomRef.baseSymptomId) {
          const baseSymptom = await prisma.baseSymptom.findUnique({
            where: { id: symptomRef.baseSymptomId },
            select: {
              name: true,
              ageGroup: true,
              briefInstruction: true,
              instructionsHtml: true,
            },
          })
          if (baseSymptom) {
            baseSymptomData = baseSymptom
          }
        } else if (symptomRef.customSymptomId) {
          const customSymptom = await prisma.surgeryCustomSymptom.findUnique({
            where: { id: symptomRef.customSymptomId },
            select: {
              name: true,
              ageGroup: true,
              briefInstruction: true,
              instructionsHtml: true,
            },
          })
          if (customSymptom) {
            baseSymptomData = customSymptom
          }
        }

        // Skip if symptom not found or has no content to work from
        if (!baseSymptomData) {
          console.log(`[AI Customisation] Skipping symptom ${symptomRef.id}: not found`)
          skippedCount++
          skippedDetails.push({ symptomId: symptomRef.id, reason: 'Symptom not found' })
          continue
        }

        // Skip if symptom has no instructions to customise
        if (!baseSymptomData.instructionsHtml && !baseSymptomData.briefInstruction) {
          console.log(`[AI Customisation] Skipping symptom ${symptomRef.id}: no content to customise`)
          skippedCount++
          skippedDetails.push({ symptomId: symptomRef.id, reason: 'No instructions to customise' })
          continue
        }

        // Get existing override (if any)
        const existingOverride = symptomRef.baseSymptomId
          ? await prisma.surgerySymptomOverride.findUnique({
              where: {
                surgeryId_baseSymptomId: {
                  surgeryId,
                  baseSymptomId: symptomRef.baseSymptomId,
                },
              },
            })
          : null

        // Call AI helper
        const onboardingProfileJson = surgery.onboardingProfile.profileJson as any
        let customised
        try {
          customised = await customiseInstructions(
            baseSymptomData,
            onboardingProfileJson,
            user.email
          )
        } catch (aiError) {
          // AI call failed - skip this symptom
          console.error(`AI call failed for symptom ${symptomRef.id}:`, aiError)
          skippedCount++
          skippedDetails.push({ symptomId: symptomRef.id, reason: 'AI error' })
          continue
        }

        // Validate AI response
        if (!customised.briefInstruction || !customised.instructionsHtml) {
          console.error(`Invalid AI response for symptom ${symptomRef.id}: missing fields`)
          skippedCount++
          skippedDetails.push({ symptomId: symptomRef.id, reason: 'Invalid AI response' })
          continue
        }

        // Use transaction to ensure all database operations succeed or fail together
        await prisma.$transaction(async (tx) => {
          if (symptomRef.baseSymptomId) {
            // For base symptoms: upsert override, create history, update review status
            const previousBriefInstruction = existingOverride?.briefInstruction ?? baseSymptomData.briefInstruction
            const previousInstructionsHtml = existingOverride?.instructionsHtml ?? baseSymptomData.instructionsHtml

            await tx.surgerySymptomOverride.upsert({
              where: {
                surgeryId_baseSymptomId: {
                  surgeryId,
                  baseSymptomId: symptomRef.baseSymptomId,
                },
              },
              create: {
                surgeryId,
                baseSymptomId: symptomRef.baseSymptomId,
                briefInstruction: customised.briefInstruction,
                instructionsHtml: customised.instructionsHtml,
                lastEditedBy: user.name || user.email,
                lastEditedAt: new Date(),
              },
              update: {
                briefInstruction: customised.briefInstruction,
                instructionsHtml: customised.instructionsHtml,
                lastEditedBy: user.name || user.email,
                lastEditedAt: new Date(),
              },
            })

            await tx.symptomHistory.create({
              data: {
                symptomId: symptomRef.baseSymptomId,
                source: 'override',
                previousText: previousInstructionsHtml || null, // Legacy field for backward compatibility
                newText: customised.instructionsHtml || previousInstructionsHtml || '', // Legacy field - ensure non-null
                previousBriefInstruction: previousBriefInstruction || null,
                newBriefInstruction: customised.briefInstruction,
                previousInstructionsHtml: previousInstructionsHtml || null,
                newInstructionsHtml: customised.instructionsHtml,
                editorName: user.name || undefined,
                editorEmail: user.email,
                modelUsed: customised.modelUsed,
                changedAt: new Date(),
              },
            })

            await tx.symptomReviewStatus.upsert({
              where: {
                surgeryId_symptomId_ageGroup: {
                  surgeryId,
                  symptomId: symptomRef.baseSymptomId,
                  ageGroup: (baseSymptomData.ageGroup || null) as unknown as string,
                },
              },
              create: {
                surgeryId,
                symptomId: symptomRef.baseSymptomId,
                ageGroup: (baseSymptomData.ageGroup || null) as unknown as string,
                status: 'PENDING',
                lastReviewedAt: null,
                reviewNote: 'AI customisation based on onboarding profile – pending clinical review',
              },
              update: {
                status: 'PENDING',
                lastReviewedAt: null,
                reviewNote: 'AI customisation based on onboarding profile – pending clinical review',
              },
            })
          } else {
            // For custom symptoms: update symptom, create history, update review status
            const previousBriefInstruction = baseSymptomData.briefInstruction
            const previousInstructionsHtml = baseSymptomData.instructionsHtml

            await tx.surgeryCustomSymptom.update({
              where: { id: symptomRef.customSymptomId! },
              data: {
                briefInstruction: customised.briefInstruction,
                instructionsHtml: customised.instructionsHtml,
                lastEditedBy: user.name || user.email,
                lastEditedAt: new Date(),
              },
            })

            await tx.symptomHistory.create({
              data: {
                symptomId: symptomRef.customSymptomId!,
                source: 'custom',
                previousText: previousInstructionsHtml || null, // Legacy field for backward compatibility
                newText: customised.instructionsHtml || previousInstructionsHtml || '', // Legacy field - ensure non-null
                previousBriefInstruction: previousBriefInstruction || null,
                newBriefInstruction: customised.briefInstruction,
                previousInstructionsHtml: previousInstructionsHtml || null,
                newInstructionsHtml: customised.instructionsHtml,
                editorName: user.name || undefined,
                editorEmail: user.email,
                modelUsed: customised.modelUsed,
                changedAt: new Date(),
              },
            })

            await tx.symptomReviewStatus.upsert({
              where: {
                surgeryId_symptomId_ageGroup: {
                  surgeryId,
                  symptomId: symptomRef.customSymptomId!,
                  ageGroup: (baseSymptomData.ageGroup || null) as unknown as string,
                },
              },
              create: {
                surgeryId,
                symptomId: symptomRef.customSymptomId!,
                ageGroup: (baseSymptomData.ageGroup || null) as unknown as string,
                status: 'PENDING',
                lastReviewedAt: null,
                reviewNote: 'AI customisation based on onboarding profile – pending clinical review',
              },
              update: {
                status: 'PENDING',
                lastReviewedAt: null,
                reviewNote: 'AI customisation based on onboarding profile – pending clinical review',
              },
            })
          }
        })

        // Only increment processedCount after successful transaction
        processedCount++
        console.log(`[AI Customisation] Successfully processed symptom ${symptomRef.id}. Total processed: ${processedCount}`)
      } catch (error) {
        // Any error during processing should skip the symptom
        console.error(`[AI Customisation] Error processing symptom ${symptomRef.id}:`, error)
        skippedCount++
        skippedDetails.push({ 
          symptomId: symptomRef.id, 
          reason: error instanceof Error ? error.message : 'Processing error' 
        })
        console.log(`[AI Customisation] Skipped symptom ${symptomRef.id}. Total skipped: ${skippedCount}`)
      }
    }

    // Log final counts for debugging
    console.log(`[AI Customisation] Final counts - Processed: ${processedCount}, Skipped: ${skippedCount}, Total symptoms to process: ${symptomsToProcess.length}`)

    // Ensure counts are numbers (defensive programming)
    const finalProcessedCount = Number(processedCount) || 0
    const finalSkippedCount = Number(skippedCount) || 0

    return NextResponse.json({
      processedCount: finalProcessedCount,
      skippedCount: finalSkippedCount,
      message: `Successfully customised ${finalProcessedCount} symptom${finalProcessedCount !== 1 ? 's' : ''}. ${finalSkippedCount > 0 ? `${finalSkippedCount} skipped.` : ''}`,
      skippedDetails,
    })
  } catch (error) {
    // Zod validation errors should be treated as bad requests.
    if (error instanceof z.ZodError) {
      const first = error.issues?.[0]?.message
      return NextResponse.json(
        { error: first || 'Invalid request format', details: error.issues },
        { status: 400 }
      )
    }
    // RBAC helpers currently throw errors containing "required" on auth failures.
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error in customise-instructions:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

