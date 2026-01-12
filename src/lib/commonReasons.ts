/**
 * Helper functions for managing "Common reasons for calling" configuration
 */

import 'server-only'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'

export interface CommonReasonsConfig {
  commonReasonsEnabled: boolean
  commonReasonsSymptomIds: string[]
  commonReasonsMax: number
}

export interface UiConfig {
  commonReasons?: CommonReasonsConfig
}

// Hard-coded fallback list of symptom names
const FALLBACK_SYMPTOM_NAMES = [
  'Abdomen Pain',
  'Acid Reflux',
  'Acne',
  'Acute Medication Request',
  'Chest Infection',
  'Cough',
  'Earache',
  'Sore Throat',
]

/**
 * Get common reasons symptoms for a surgery
 * Returns configured symptoms if available, otherwise falls back to hard-coded defaults
 */
export function getCommonReasonsForSurgery(
  uiConfig: UiConfig | null | undefined,
  effectiveSymptoms: EffectiveSymptom[],
  fallbackNames: string[] = FALLBACK_SYMPTOM_NAMES
): EffectiveSymptom[] {
  // If no config or disabled, use fallback
  if (!uiConfig?.commonReasons?.commonReasonsEnabled) {
    return getFallbackSymptoms(effectiveSymptoms, fallbackNames)
  }

  const config = uiConfig.commonReasons
  const max = config.commonReasonsMax || 8

  // Resolve symptom IDs to symptom objects
  const symptomMap = new Map(effectiveSymptoms.map(s => [s.id, s]))
  const resolved: EffectiveSymptom[] = []

  // Preserve order from config, skip missing/disabled symptoms
  for (const symptomId of config.commonReasonsSymptomIds) {
    const symptom = symptomMap.get(symptomId)
    if (symptom && !symptom.isHidden) {
      resolved.push(symptom)
      if (resolved.length >= max) break
    }
  }

  // If no valid symptoms found, fall back to defaults
  if (resolved.length === 0) {
    return getFallbackSymptoms(effectiveSymptoms, fallbackNames)
  }

  return resolved
}

/**
 * Get fallback symptoms by matching names against effective symptoms
 */
function getFallbackSymptoms(
  effectiveSymptoms: EffectiveSymptom[],
  fallbackNames: string[]
): EffectiveSymptom[] {
  const symptomMap = new Map(
    effectiveSymptoms.map(s => [s.name.toLowerCase().trim(), s])
  )

  const resolved: EffectiveSymptom[] = []
  for (const name of fallbackNames) {
    const symptom = symptomMap.get(name.toLowerCase().trim())
    if (symptom && !symptom.isHidden) {
      resolved.push(symptom)
    }
  }

  return resolved
}

/**
 * Validate common reasons config
 */
export function validateCommonReasonsConfig(
  config: Partial<CommonReasonsConfig>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (config.commonReasonsEnabled !== undefined && typeof config.commonReasonsEnabled !== 'boolean') {
    errors.push('commonReasonsEnabled must be a boolean')
  }

  if (config.commonReasonsSymptomIds !== undefined) {
    if (!Array.isArray(config.commonReasonsSymptomIds)) {
      errors.push('commonReasonsSymptomIds must be an array')
    } else {
      // Dedupe and validate IDs
      const uniqueIds = Array.from(new Set(config.commonReasonsSymptomIds))
      if (uniqueIds.some(id => typeof id !== 'string')) {
        errors.push('All symptom IDs must be strings')
      }
      config.commonReasonsSymptomIds = uniqueIds
    }
  }

  if (config.commonReasonsMax !== undefined) {
    if (typeof config.commonReasonsMax !== 'number') {
      errors.push('commonReasonsMax must be a number')
    } else if (config.commonReasonsMax < 0 || config.commonReasonsMax > 20) {
      errors.push('commonReasonsMax must be between 0 and 20')
    }
  }

  return { valid: errors.length === 0, errors }
}

