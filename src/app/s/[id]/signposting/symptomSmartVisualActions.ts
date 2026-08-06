'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { zodFieldErrors, type ActionResult } from '@/server/actionResult'
import { requireSymptomSmartVisualEdit } from '@/server/symptomSmartVisualGates'
import { computeSymptomSmartVisualFingerprint } from '@/server/symptomSmartVisual'
import { markSymptomPendingReview } from '@/server/clinicalReview'
import {
  SymptomSmartVisualLayoutZ,
  normalizeSymptomSmartVisualLayout,
  symptomSmartVisualSectionTypes,
} from '@/lib/symptomSmartVisualShared'

const saveSymptomSmartVisualInput = z.object({
  surgeryId: z.string().min(1),
  symptomId: z.string().min(1),
  variantKey: z.string().max(120).optional(),
  layout: z.unknown(),
  sourceFingerprint: z.string().length(64),
  modelUsed: z.string().max(120).optional(),
})

/**
 * Persist a previewed smart visual for one symptom variant.
 *
 * Unlike the Practice Handbook equivalent, saving here puts the symptom back
 * into clinical review: signposting content is clinical, and a smart visual is
 * an AI *reinterpretation* of it (deciding what counts as a red flag and what
 * order steps go in), so a clinician must approve it before staff can see it.
 */
export async function saveSymptomSmartVisual(
  input: unknown
): Promise<ActionResult<{ symptomId: string; variantKey: string }>> {
  const parsed = saveSymptomSmartVisualInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input.',
        fieldErrors: zodFieldErrors(parsed.error),
      },
    }
  }
  const { surgeryId, symptomId, sourceFingerprint, modelUsed } = parsed.data
  const requestedVariantKey = parsed.data.variantKey ?? ''

  const gate = await requireSymptomSmartVisualEdit(surgeryId, symptomId, requestedVariantKey)
  if (!gate.ok) return gate
  const { symptom, symptomKeyId, variant, userId, userEmail } = gate.data

  // Never trust the client blob — re-validate and normalise server-side.
  const layoutParsed = SymptomSmartVisualLayoutZ.safeParse(parsed.data.layout)
  if (!layoutParsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid smart visual layout.',
        fieldErrors: zodFieldErrors(layoutParsed.error),
      },
    }
  }
  let layout
  try {
    layout = normalizeSymptomSmartVisualLayout(layoutParsed.data)
  } catch {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid smart visual layout.' } }
  }

  try {
    // Recompute the fingerprint from current DB state: if the instructions
    // changed between generation and save, reject rather than saving a visual
    // that no longer matches its source.
    const currentFingerprint = computeSymptomSmartVisualFingerprint(symptom, variant)
    if (currentFingerprint !== sourceFingerprint) {
      return {
        ok: false,
        error: {
          code: 'STALE',
          message:
            'The symptom content changed while you were previewing. Please regenerate the visual.',
        },
      }
    }

    const sectionTypes = symptomSmartVisualSectionTypes(layout)
    const variantSuffix = variant.variantLabel ? ` for ${variant.variantLabel}` : ''
    const summary = `Saved smart visual${variantSuffix} (${sectionTypes.length} section${
      sectionTypes.length === 1 ? '' : 's'
    }: ${sectionTypes.join(', ')})`

    await prisma.$transaction([
      prisma.symptomSmartVisual.upsert({
        where: {
          surgeryId_symptomId_variantKey: {
            surgeryId,
            symptomId: symptomKeyId,
            variantKey: variant.variantKey,
          },
        },
        create: {
          surgeryId,
          symptomId: symptomKeyId,
          variantKey: variant.variantKey,
          layoutJson: layout,
          sourceFingerprint: currentFingerprint,
          modelUsed: modelUsed ?? null,
          generatedByUserId: userId,
        },
        update: {
          layoutJson: layout,
          sourceFingerprint: currentFingerprint,
          modelUsed: modelUsed ?? null,
          generatedAt: new Date(),
          generatedByUserId: userId,
        },
      }),
      // AI-derived output stays attributable exactly as an AI wording edit does.
      // newText is the legacy non-null column, so the audit summary goes there.
      prisma.symptomHistory.create({
        data: {
          symptomId: symptomKeyId,
          source: symptom.source,
          newText: summary,
          editorEmail: userEmail,
          modelUsed: modelUsed ?? 'unknown-model',
        },
      }),
    ])

    // Outside the transaction: this recounts pending reviews and revalidates
    // surgery caches, so it must not hold the write open.
    await markSymptomPendingReview(surgeryId, symptomKeyId, symptom.ageGroup)

    return { ok: true, data: { symptomId: symptomKeyId, variantKey: variant.variantKey } }
  } catch (error) {
    console.error('saveSymptomSmartVisual failed:', error)
    return { ok: false, error: { code: 'UNKNOWN', message: 'Failed to save the smart visual.' } }
  }
}

const removeSymptomSmartVisualInput = z.object({
  surgeryId: z.string().min(1),
  symptomId: z.string().min(1),
  variantKey: z.string().max(120).optional(),
})

/**
 * Delete a saved smart visual. Removing one only takes a view away, so it does
 * not put the symptom back into clinical review.
 */
export async function removeSymptomSmartVisual(
  input: unknown
): Promise<ActionResult<{ symptomId: string; variantKey: string }>> {
  const parsed = removeSymptomSmartVisualInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input.',
        fieldErrors: zodFieldErrors(parsed.error),
      },
    }
  }
  const { surgeryId, symptomId } = parsed.data
  const requestedVariantKey = parsed.data.variantKey ?? ''

  const gate = await requireSymptomSmartVisualEdit(surgeryId, symptomId, requestedVariantKey)
  if (!gate.ok) return gate
  const { symptom, symptomKeyId, variant, userEmail } = gate.data

  try {
    const deleted = await prisma.symptomSmartVisual.deleteMany({
      where: { surgeryId, symptomId: symptomKeyId, variantKey: variant.variantKey },
    })

    // Only record history when something was actually removed, so a repeated
    // click stays idempotent instead of stacking audit rows.
    if (deleted.count > 0) {
      const variantSuffix = variant.variantLabel ? ` for ${variant.variantLabel}` : ''
      await prisma.symptomHistory.create({
        data: {
          symptomId: symptomKeyId,
          source: symptom.source,
          newText: `Removed smart visual${variantSuffix}`,
          editorEmail: userEmail,
        },
      })
    }

    return { ok: true, data: { symptomId: symptomKeyId, variantKey: variant.variantKey } }
  } catch (error) {
    console.error('removeSymptomSmartVisual failed:', error)
    return { ok: false, error: { code: 'UNKNOWN', message: 'Failed to remove the smart visual.' } }
  }
}
