/**
 * Primitives shared by every "smart visual" layout contract.
 *
 * A smart visual is an AI-generated, structured layout rendered by an approved
 * set of React components. Each surface (Practice Handbook, signposting
 * symptoms) defines its own catalogue of section types, but they all share the
 * same theme/icon enums, the same capped-string helpers and the same
 * plain-text normalisation rule — so they are defined once, here.
 *
 * Keep this file free of `server-only` and heavy runtime dependencies: the
 * layout contracts built on it are imported by client components.
 */

import { z } from 'zod'

export const SMART_VISUAL_THEMES = ['blue', 'green', 'amber', 'red', 'grey'] as const
export const ThemeZ = z.enum(SMART_VISUAL_THEMES)
export type SmartVisualTheme = z.infer<typeof ThemeZ>

export const SMART_VISUAL_ICONS = [
  'phone',
  'email',
  'clock',
  'alert',
  'check',
  'info',
  'people',
  'document',
  'star',
  'calendar',
] as const
export const IconZ = z.enum(SMART_VISUAL_ICONS)
export type SmartVisualIcon = z.infer<typeof IconZ>

/** A required plain-text field, trimmed and hard-capped. */
export const Txt = (max: number) => z.string().trim().min(1).max(max)

/** An optional plain-text field, trimmed and hard-capped. */
export const OptTxt = (max: number) => z.string().trim().max(max).optional()

/**
 * Strip any HTML tags and collapse whitespace in a plain-text field.
 * The renderers only ever emit text nodes, so this is belt-and-braces.
 */
function toPlainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanValue(value: unknown): unknown {
  if (typeof value === 'string') return toPlainText(value)
  if (Array.isArray(value)) return value.map(cleanValue)
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = cleanValue(v)
      // Drop optional string fields that became empty after stripping
      if (typeof cleaned === 'string' && cleaned === '' && k !== 'type') continue
      result[k] = cleaned
    }
    return result
  }
  return value
}

/**
 * Post-parse normalisation of an already-validated layout: strips stray HTML
 * tags, collapses whitespace and drops emptied optional string fields, then
 * re-validates so normalisation can never produce an out-of-contract object
 * (e.g. a required field emptied by tag stripping).
 *
 * Run this after `safeParse` on every path that accepts a layout (generation
 * and save) — never trust AI or client input to be plain text.
 *
 * @throws when the normalised value no longer satisfies the schema.
 */
export function normalizeLayoutWithSchema<T>(schema: z.ZodType<T>, layout: T): T {
  const reparsed = schema.safeParse(cleanValue(layout))
  if (!reparsed.success) {
    throw new Error('Smart visual layout became invalid after normalisation.')
  }
  return reparsed.data
}
