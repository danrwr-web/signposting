/**
 * Replace "Book a red slot" with the full escalation wording.
 * Used as post-processing for AI-generated card content (MCQ options, interactions, etc.).
 */
const BOOK_RED_SLOT = /Book a red slot/gi
const REPLACEMENT =
  'Book a red slot (or pink/purple today if any remaining) - Remember to IM the GP'

export function replaceRedSlotWording(text: string): string {
  if (typeof text !== 'string') return text
  return text.replace(BOOK_RED_SLOT, REPLACEMENT)
}

function replaceInArray(arr: unknown[]): unknown[] {
  return arr.map((item) => {
    if (typeof item === 'string') return replaceRedSlotWording(item)
    if (Array.isArray(item)) return replaceInArray(item)
    if (item && typeof item === 'object') return replaceInObject(item as Record<string, unknown>)
    return item
  })
}

function replaceInObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      out[key] = replaceRedSlotWording(value)
    } else if (Array.isArray(value)) {
      out[key] = replaceInArray(value)
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = replaceInObject(value as Record<string, unknown>)
    } else {
      out[key] = value
    }
  }
  return out
}

/** Apply red slot wording replacement to card-like data (cards, interactions, quiz, patch). */
export function applyRedSlotWording<T>(data: T): T {
  if (typeof data === 'string') return replaceRedSlotWording(data) as T
  if (Array.isArray(data)) return replaceInArray(data) as T
  if (data && typeof data === 'object') return replaceInObject(data as Record<string, unknown>) as T
  return data
}
