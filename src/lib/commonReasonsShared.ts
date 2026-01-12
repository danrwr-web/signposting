/**
 * Shared (client-safe) types and constants for Quick Access / Common Reasons.
 *
 * Keep this file free of `server-only` so it can be imported by client components.
 */

export const COMMON_REASONS_MAX = 6 as const

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

