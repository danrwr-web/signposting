import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSymptomSmartVisualEdit } from '@/server/symptomSmartVisualGates'
import {
  generateSymptomSmartVisualLayout,
  symptomSmartVisualHasContent,
  SymptomSmartVisualSourceTooLongError,
} from '@/server/symptomSmartVisual'
import { AzureOpenAIError } from '@/server/azureOpenAI'
import { SymptomSmartVisualLayoutZ } from '@/lib/symptomSmartVisualShared'

export const runtime = 'nodejs'
export const maxDuration = 60

const generateSymptomSmartVisualSchema = z.object({
  surgeryId: z.string().min(1),
  symptomId: z.string().min(1),
  /** '' targets the symptom's main instructions; otherwise an age-variant key. */
  // No length cap: the authoring side (VariantAgeGroupZ, VariantGroupsEditor)
  // does not impose one, so any cap here rejects a variant that is valid,
  // persisted and selectable elsewhere in the app — failing before the key can
  // even be resolved. The key is checked against this symptom's real variants
  // server-side, so an unknown one is rejected on its merits rather than its
  // length, and request size is already bounded by the platform.
  variantKey: z.string().optional(),
  guidance: z.string().trim().max(500).optional(),
})

const GATE_ERROR_STATUS: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  FEATURE_DISABLED: 403,
  NOT_FOUND: 404,
}

/**
 * Generate a smart visual layout preview for a symptom's triage instructions.
 * Nothing is persisted — saving is a separate server action so the admin can
 * review the preview first, and saving is what puts the symptom back into
 * clinical review.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { surgeryId, symptomId, variantKey, guidance } =
      generateSymptomSmartVisualSchema.parse(body)

    const gate = await requireSymptomSmartVisualEdit(surgeryId, symptomId, variantKey ?? '')
    if (!gate.ok) {
      return NextResponse.json(
        { error: gate.error.message },
        { status: GATE_ERROR_STATUS[gate.error.code] ?? 403 }
      )
    }
    const { symptom, symptomKeyId, variant, userEmail, hideAgeBands } = gate.data

    if (!symptomSmartVisualHasContent(variant)) {
      return NextResponse.json(
        {
          error:
            'This symptom has no instructions to generate a visual from yet. Add some instructions first.',
        },
        { status: 400 }
      )
    }

    // When a visual already exists for this variant, pass its layout so
    // regeneration keeps the structure stable wherever the content allows.
    const existingVisual = await prisma.symptomSmartVisual.findUnique({
      where: {
        surgeryId_symptomId_variantKey: {
          surgeryId,
          symptomId: symptomKeyId,
          variantKey: variant.variantKey,
        },
      },
      select: { layoutJson: true },
    })
    const previousParsed = existingVisual
      ? SymptomSmartVisualLayoutZ.safeParse(existingVisual.layoutJson)
      : null
    const previousLayout = previousParsed?.success ? previousParsed.data : undefined

    const result = await generateSymptomSmartVisualLayout(symptom, variant, userEmail, {
      guidance,
      previousLayout,
      hideAgeBands,
    })

    return NextResponse.json({
      layout: result.layout,
      sourceFingerprint: result.sourceFingerprint,
      variantKey: variant.variantKey,
      modelUsed: result.modelUsed,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Symptom smart visual generation error:', error)

    // Not a failure to generate — a refusal to, because the result would have
    // been built from part of the guidance. 422 so the client shows the reason
    // rather than a generic retryable error.
    if (error instanceof SymptomSmartVisualSourceTooLongError) {
      return NextResponse.json({ error: error.clientMessage }, { status: 422 })
    }

    if (error instanceof AzureOpenAIError) {
      const httpStatus = error.status === 0 || error.status >= 500 ? 503 : 500
      return NextResponse.json({ error: error.clientMessage }, { status: httpStatus })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    const message =
      error instanceof Error && error.message.startsWith('The AI returned an invalid layout')
        ? error.message
        : 'Failed to generate smart visual'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
