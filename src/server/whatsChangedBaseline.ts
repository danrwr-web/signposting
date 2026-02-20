/**
 * Server-only helpers for managing per-surgery "What's changed" baseline dates.
 * 
 * These baselines allow newly onboarded surgeries to avoid showing a flood of
 * "recent changes" from initial import/migration. Changes before the baseline
 * are excluded from "What's changed" feeds.
 * 
 * Storage: Surgery.uiConfig JSON
 *   - uiConfig.signposting.changesBaselineDate (ISO date string)
 *   - uiConfig.practiceHandbook.changesBaselineDate (ISO date string)
 */

import 'server-only'
import { prisma } from '@/lib/prisma'

export type WhatsChangedModule = 'signposting' | 'practiceHandbook'

interface UiConfigWithBaselines {
  signposting?: {
    changesBaselineDate?: string
  }
  practiceHandbook?: {
    changesBaselineDate?: string
  }
  [key: string]: unknown
}

/**
 * Reads the "What's changed" baseline date for a module from surgery uiConfig.
 * Returns null if not set.
 */
export function readChangesBaselineDate(
  uiConfig: unknown,
  module: WhatsChangedModule
): Date | null {
  if (!uiConfig || typeof uiConfig !== 'object') return null
  
  const config = uiConfig as UiConfigWithBaselines
  const dateStr = config[module]?.changesBaselineDate
  
  if (!dateStr || typeof dateStr !== 'string') return null
  
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? null : date
}

/**
 * Fetches the "What's changed" baseline date for a surgery and module.
 * Returns null if not set.
 */
export async function getChangesBaselineDate(
  surgeryId: string,
  module: WhatsChangedModule
): Promise<Date | null> {
  const surgery = await prisma.surgery.findUnique({
    where: { id: surgeryId },
    select: { uiConfig: true },
  })
  
  return readChangesBaselineDate(surgery?.uiConfig, module)
}

/**
 * Computes the effective cutoff date for "What's changed" queries.
 * Returns the later of: (now - windowDays) OR baselineDate (if set).
 * 
 * @param windowDays - Rolling window in days (default: 14)
 * @param baselineDate - Surgery-specific baseline (optional)
 * @returns The effective cutoff date
 */
export function computeEffectiveCutoffDate(
  windowDays: number,
  baselineDate: Date | null
): Date {
  const windowCutoff = new Date()
  windowCutoff.setDate(windowCutoff.getDate() - windowDays)
  
  if (!baselineDate) return windowCutoff
  
  // Use the later of: rolling window cutoff OR the baseline date
  return windowCutoff > baselineDate ? windowCutoff : baselineDate
}

/**
 * Checks if the baseline date is "active" (i.e. later than the rolling window cutoff).
 * Used to determine which helper text to show on the page.
 */
export function isBaselineActive(
  windowDays: number,
  baselineDate: Date | null
): boolean {
  if (!baselineDate) return false
  
  const windowCutoff = new Date()
  windowCutoff.setDate(windowCutoff.getDate() - windowDays)
  
  return baselineDate > windowCutoff
}

/**
 * Sets the "What's changed" baseline date for a surgery and module.
 * Use this during onboarding to set the baseline to "today" or a specific date.
 * 
 * @param surgeryId - The surgery ID
 * @param module - 'signposting' or 'practiceHandbook'
 * @param baselineDate - The baseline date (ISO string or Date). Pass null to clear.
 */
export async function setChangesBaselineDate(
  surgeryId: string,
  module: WhatsChangedModule,
  baselineDate: Date | string | null
): Promise<void> {
  const surgery = await prisma.surgery.findUnique({
    where: { id: surgeryId },
    select: { uiConfig: true },
  })
  
  const currentConfig = (surgery?.uiConfig as UiConfigWithBaselines) ?? {}
  
  // Build updated config
  const dateStr = baselineDate
    ? (baselineDate instanceof Date ? baselineDate.toISOString() : baselineDate)
    : undefined
  
  const updatedConfig: UiConfigWithBaselines = {
    ...currentConfig,
    [module]: {
      ...currentConfig[module],
      changesBaselineDate: dateStr,
    },
  }
  
  // If clearing the date, clean up empty objects
  if (!dateStr && updatedConfig[module]) {
    delete updatedConfig[module]!.changesBaselineDate
    if (Object.keys(updatedConfig[module]!).length === 0) {
      delete updatedConfig[module]
    }
  }
  
  await prisma.surgery.update({
    where: { id: surgeryId },
    data: { uiConfig: updatedConfig as import('@prisma/client').Prisma.InputJsonValue },
  })
}

/**
 * Formats a baseline date for display in helper text.
 * Returns a human-readable date string like "23 January 2026".
 */
export function formatBaselineDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
