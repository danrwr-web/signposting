import 'server-only'

import { getSessionUser, can } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { FEATURE_AI_SYMPTOM_VISUALS, FEATURE_HIDE_AGE_BANDS } from '@/lib/featureKeys'
import { getEffectiveSymptomById, type EffectiveSymptom } from '@/server/effectiveSymptoms'
import { resolveSymptomVariant, type ResolvedSymptomVariant } from '@/server/symptomSmartVisual'
import type { ActionResult } from '@/server/actionResult'

export type SymptomSmartVisualGateData = {
  userId: string
  userEmail: string | null
  isSuperuser: boolean
  symptom: EffectiveSymptom
  /**
   * The id a visual (and a review status) is keyed by: the base symptom id for
   * base/override symptoms, the custom symptom id otherwise. Mirrors the
   * targeting rule the instruction save paths already use.
   */
  symptomKeyId: string
  variant: ResolvedSymptomVariant
  /**
   * Resolved here so generation and save compute the fingerprint from exactly
   * the same prompt options — see `computeSymptomSmartVisualFingerprint`.
   */
  hideAgeBands: boolean
}

/**
 * Gate for generating or saving a symptom smart visual.
 *
 * Requires surgery-admin rights (the same bar as applying AI wording changes)
 * plus the ai_symptom_visuals flag, which superusers bypass so they can test
 * and demo the feature on any practice. Also resolves the symptom and the
 * requested age-group variant, rejecting a variant the symptom does not have —
 * a visual must never be generated against wording nobody can see.
 */
export async function requireSymptomSmartVisualEdit(
  surgeryId: string,
  symptomId: string,
  variantKey: string
): Promise<ActionResult<SymptomSmartVisualGateData>> {
  const user = await getSessionUser()
  if (!user) {
    return { ok: false, error: { code: 'UNAUTHENTICATED', message: 'You must be signed in.' } }
  }

  if (!can(user).manageSurgery(surgeryId)) {
    return {
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Only practice admins can create smart visuals. Ask a surgery admin.',
      },
    }
  }

  const isSuperuser = can(user).isSuperuser()
  const enabled = isSuperuser || (await isFeatureEnabledForSurgery(surgeryId, FEATURE_AI_SYMPTOM_VISUALS))
  if (!enabled) {
    return {
      ok: false,
      error: {
        code: 'FEATURE_DISABLED',
        message: 'AI symptom smart visuals are not enabled for this surgery.',
      },
    }
  }

  const symptom = await getEffectiveSymptomById(symptomId, surgeryId)
  if (!symptom) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Symptom not found.' } }
  }

  const variant = resolveSymptomVariant(symptom, variantKey)
  if (!variant) {
    return {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'That age-group version of this symptom no longer exists. Reload the page and try again.',
      },
    }
  }

  const hideAgeBands = await isFeatureEnabledForSurgery(surgeryId, FEATURE_HIDE_AGE_BANDS)

  return {
    ok: true,
    data: {
      userId: user.id,
      userEmail: user.email ?? null,
      isSuperuser,
      symptom,
      symptomKeyId: symptomKeyIdFor(symptom),
      variant,
      hideAgeBands,
    },
  }
}

/**
 * The id smart visuals and review statuses are keyed by. An override's
 * effective id is already the base symptom id, but `baseSymptomId` is used
 * explicitly so the key never depends on that coincidence.
 */
export function symptomKeyIdFor(symptom: EffectiveSymptom): string {
  return symptom.source === 'override' ? (symptom.baseSymptomId ?? symptom.id) : symptom.id
}
