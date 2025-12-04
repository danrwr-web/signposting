import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { CustomiseInstructionsReqZ } from '@/lib/api-contracts'
import { customiseInstructions } from '@/server/aiCustomiseInstructions'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'

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

      symptomsToProcess = [
        ...baseSymptoms.map((s) => ({ id: s.id, baseSymptomId: s.id })),
        ...customSymptoms.map((s) => ({ id: s.id, customSymptomId: s.id })),
      ]
    }

    // Process each symptom
    let processedCount = 0
    let skippedCount = 0

    for (const symptomRef of symptomsToProcess) {
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
          skippedCount++
          continue
        }

        // Skip if symptom has no instructions to customise
        if (!baseSymptomData.instructionsHtml && !baseSymptomData.briefInstruction) {
          skippedCount++
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
          continue
        }

        // Validate AI response
        if (!customised.briefInstruction || !customised.instructionsHtml) {
          console.error(`Invalid AI response for symptom ${symptomRef.id}: missing fields`)
          skippedCount++
          continue
        }

        // Upsert override (only for base symptoms - custom symptoms don't have overrides)
        if (symptomRef.baseSymptomId) {
          const previousBriefInstruction = existingOverride?.briefInstruction ?? baseSymptomData.briefInstruction
          const previousInstructionsHtml = existingOverride?.instructionsHtml ?? baseSymptomData.instructionsHtml

          await prisma.surgerySymptomOverride.upsert({
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

          // Create SymptomHistory entry
          await prisma.symptomHistory.create({
            data: {
              symptomId: symptomRef.baseSymptomId,
              source: 'override',
              previousBriefInstruction: previousBriefInstruction || undefined,
              newBriefInstruction: customised.briefInstruction,
              previousInstructionsHtml: previousInstructionsHtml || undefined,
              newInstructionsHtml: customised.instructionsHtml,
              editorName: user.name || undefined,
              editorEmail: user.email,
              modelUsed: customised.modelUsed,
              changedAt: new Date(),
            },
          })

          // Force SymptomReviewStatus back to PENDING (even if previously APPROVED)
          await prisma.symptomReviewStatus.upsert({
            where: {
              surgeryId_symptomId_ageGroup: {
                surgeryId,
                symptomId: symptomRef.baseSymptomId,
                ageGroup: baseSymptomData.ageGroup || null,
              },
            },
            create: {
              surgeryId,
              symptomId: symptomRef.baseSymptomId,
              ageGroup: baseSymptomData.ageGroup || null,
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
          // For custom symptoms, update directly and create history
          const previousBriefInstruction = baseSymptomData.briefInstruction
          const previousInstructionsHtml = baseSymptomData.instructionsHtml

          await prisma.surgeryCustomSymptom.update({
            where: { id: symptomRef.customSymptomId! },
            data: {
              briefInstruction: customised.briefInstruction,
              instructionsHtml: customised.instructionsHtml,
              lastEditedBy: user.name || user.email,
              lastEditedAt: new Date(),
            },
          })

          // Create SymptomHistory entry
          await prisma.symptomHistory.create({
            data: {
              symptomId: symptomRef.customSymptomId!,
              source: 'custom',
              previousBriefInstruction: previousBriefInstruction || undefined,
              newBriefInstruction: customised.briefInstruction,
              previousInstructionsHtml: previousInstructionsHtml || undefined,
              newInstructionsHtml: customised.instructionsHtml,
              editorName: user.name || undefined,
              editorEmail: user.email,
              modelUsed: customised.modelUsed,
              changedAt: new Date(),
            },
          })

          // Force SymptomReviewStatus back to PENDING (even if previously APPROVED)
          await prisma.symptomReviewStatus.upsert({
            where: {
              surgeryId_symptomId_ageGroup: {
                surgeryId,
                symptomId: symptomRef.customSymptomId!,
                ageGroup: baseSymptomData.ageGroup || null,
              },
            },
            create: {
              surgeryId,
              symptomId: symptomRef.customSymptomId!,
              ageGroup: baseSymptomData.ageGroup || null,
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

        // Only increment processedCount after successful database writes
        processedCount++
      } catch (error) {
        // Any error during processing should skip the symptom
        console.error(`Error processing symptom ${symptomRef.id}:`, error)
        skippedCount++
      }
    }

    return NextResponse.json({
      processedCount,
      skippedCount,
      message: `Successfully customised ${processedCount} symptom${processedCount !== 1 ? 's' : ''}. ${skippedCount > 0 ? `${skippedCount} skipped.` : ''}`,
    })
  } catch (error) {
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

