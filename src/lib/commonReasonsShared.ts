/**
 * Shared (client-safe) types and constants for Quick Access / Common Reasons.
 *
 * Keep this file free of `server-only` so it can be imported by client components.
 */

import type { EffectiveSymptom } from '@/server/effectiveSymptoms'

export const COMMON_REASONS_MAX = 6 as const

// Buttons shown for surgeries that have never saved a quick access config.
// Matched case-insensitively against the surgery's effective symptom names.
export const FALLBACK_SYMPTOM_NAMES = [
  'Abdomen Pain',
  'Acid Reflux',
  'Acne',
  'Acute Medication Request',
  'Chest Infection',
  'Cough',
  'Earache',
  'Sore Throat',
]

export interface CommonReasonsItem {
  symptomId: string
  label?: string | null
}

export interface CommonReasonsConfig {
  commonReasonsEnabled: boolean
  /**
   * Legacy setting (no longer configurable in UI). Treated as a fixed max of 6.
   */
  commonReasonsMax?: number
  // New format: items array with optional labels
  items?: CommonReasonsItem[]
  // Legacy format: symptomIds array (for backward compatibility)
  commonReasonsSymptomIds?: string[]
}

export interface UiConfig {
  commonReasons?: CommonReasonsConfig
}

/**
 * A surgery only has an explicit quick access config once commonReasonsEnabled
 * has been saved as a boolean. Anything else (no uiConfig, no commonReasons key,
 * malformed value) means the surgery falls back to the default buttons.
 */
export function hasExplicitCommonReasonsConfig(
  config: CommonReasonsConfig | null | undefined
): config is CommonReasonsConfig {
  return typeof config?.commonReasonsEnabled === 'boolean'
}

/**
 * Resolve the fallback (default) quick access symptoms for a surgery by
 * matching FALLBACK_SYMPTOM_NAMES against its effective symptoms, capped at
 * COMMON_REASONS_MAX. Used by both the staff home screen and the admin editor
 * so they always agree on what an unconfigured surgery displays.
 */
export function resolveFallbackCommonReasonSymptoms(
  effectiveSymptoms: EffectiveSymptom[],
  fallbackNames: string[] = FALLBACK_SYMPTOM_NAMES
): EffectiveSymptom[] {
  const symptomMap = new Map(
    effectiveSymptoms.map(s => [s.name.toLowerCase().trim(), s])
  )

  const resolved: EffectiveSymptom[] = []
  for (const name of fallbackNames) {
    const symptom = symptomMap.get(name.toLowerCase().trim())
    if (symptom && !symptom.isHidden) {
      resolved.push(symptom)
      if (resolved.length >= COMMON_REASONS_MAX) break
    }
  }

  return resolved
}
