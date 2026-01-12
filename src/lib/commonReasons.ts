/**
 * Helper functions for managing "Common reasons for calling" configuration
 */

import 'server-only'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import {
  COMMON_REASONS_MAX,
  type CommonReasonsConfig,
  type CommonReasonsItem,
  type UiConfig,
} from '@/lib/commonReasonsShared'

export { COMMON_REASONS_MAX }
export type { CommonReasonsConfig, CommonReasonsItem, UiConfig }

export interface CommonReasonsResolvedItem {
  symptom: EffectiveSymptom
  label?: string | null
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
 * Normalize common reasons config to new format (items array)
 * Handles backward compatibility by converting legacy symptomIds to items
 */
export function normalizeCommonReasonsConfig(config: CommonReasonsConfig): CommonReasonsItem[] {
  // Prefer new format if present
  if (config.items && Array.isArray(config.items)) {
    // Deduplicate by symptomId, preserving first occurrence
    const seen = new Set<string>()
    return config.items.filter(item => {
      if (!item.symptomId || seen.has(item.symptomId)) return false
      seen.add(item.symptomId)
      return true
    })
  }

  // Legacy format: convert symptomIds to items
  if (config.commonReasonsSymptomIds && Array.isArray(config.commonReasonsSymptomIds)) {
    // Deduplicate by symptomId, preserving first occurrence
    const seen = new Set<string>()
    return config.commonReasonsSymptomIds
      .filter(id => {
        if (!id || seen.has(id)) return false
        seen.add(id)
        return true
      })
      .map(id => ({ symptomId: id }))
  }

  return []
}

/**
 * Get common reasons items for a surgery with resolved symptoms and labels
 * Returns resolved items if available, otherwise falls back to hard-coded defaults
 */
export function getCommonReasonsForSurgery(
  uiConfig: UiConfig | null | undefined,
  effectiveSymptoms: EffectiveSymptom[],
  fallbackNames: string[] = FALLBACK_SYMPTOM_NAMES
): CommonReasonsResolvedItem[] {
  const config = uiConfig?.commonReasons
  const max = COMMON_REASONS_MAX

  // If config exists and is disabled: render nothing
  if (config && config.commonReasonsEnabled === false) {
    return []
  }

  // If config exists and is enabled
  if (config && config.commonReasonsEnabled === true) {
    const items = normalizeCommonReasonsConfig(config)

    // If enabled but no items configured, show nothing (no fallback)
    if (items.length === 0) {
      return []
    }

    const symptomMap = new Map(effectiveSymptoms.map(s => [s.id, s]))
    const resolved: CommonReasonsResolvedItem[] = []

      for (const item of items) {
        const symptom = symptomMap.get(item.symptomId)
        if (symptom && !symptom.isHidden) {
          // Use label as-is (already normalized on save)
          // Only trim if somehow not normalized, but preserve spaces
          const label = item.label?.trim() || undefined
          resolved.push({
            symptom,
            label: label || undefined
          })
          if (resolved.length >= max) break
        }
      }

    // If enabled config yields no valid symptoms, show nothing (no fallback)
    return resolved
  }

  // No config present: use fallback names
  const fallbackSymptoms = getFallbackSymptoms(effectiveSymptoms, fallbackNames)
  return fallbackSymptoms.slice(0, max).map(symptom => ({ symptom }))
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

  // Validate new format (items)
  if (config.items !== undefined) {
    if (!Array.isArray(config.items)) {
      errors.push('items must be an array')
    } else {
      const seen = new Set<string>()
      for (const item of config.items) {
        if (!item.symptomId || typeof item.symptomId !== 'string') {
          errors.push('All items must have a symptomId string')
        } else if (seen.has(item.symptomId)) {
          errors.push(`Duplicate symptomId: ${item.symptomId}`)
        } else {
          seen.add(item.symptomId)
        }
        if (item.label !== undefined && item.label !== null && typeof item.label !== 'string') {
          errors.push('Label must be a string or null')
        }
      }
      // Deduplicate by symptomId, preserving first occurrence
      if (errors.length === 0) {
        const uniqueItems: CommonReasonsItem[] = []
        const seenIds = new Set<string>()
        for (const item of config.items) {
          if (!seenIds.has(item.symptomId)) {
            seenIds.add(item.symptomId)
            // Normalize label: trim whitespace, convert empty string to undefined
            const label = item.label?.trim() || undefined
            uniqueItems.push({ symptomId: item.symptomId, label })
          }
        }
        config.items = uniqueItems
      }
    }
  }

  // Validate legacy format (commonReasonsSymptomIds) for backward compatibility
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
    } else {
      // Kept only for backward compatibility; UI no longer allows changing this.
      // Treat as a fixed maximum everywhere.
      config.commonReasonsMax = COMMON_REASONS_MAX
    }
  }

  return { valid: errors.length === 0, errors }
}

