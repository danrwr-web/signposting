/**
 * Utility function to clean legacy formatting artefacts from instruction text
 * 
 * Fixes:
 * - "?? " at the start of lines
 * - "?? " or "??" before "Book a..."
 * - "?? " before "If none of the above apply:"
 * - "? 38°C" -> "≥ 38°C" (temperature comparisons)
 */

export function cleanLegacyFormatting(text: string): string {
  if (!text || typeof text !== 'string') {
    return text
  }

  return text
    // Remove "?? " at the start of a line
    .replace(/^\?\?\s+/gm, '')
    // Remove "?? " directly before "Book a …"
    .replace(/\?\?\s+(Book a)/g, '$1')
    // Remove "??" (no space) directly before "Book a …"
    .replace(/\?\?(Book a)/g, '$1')
    // Remove "?? " directly before "If none of the above apply:"
    .replace(/\?\?\s+(If none of the above apply:)/g, '$1')
    // Fix high temperature comparisons where ≥ became ?
    .replace(/\?\s*38°C/g, '≥ 38°C')
    // Also handle other temperature patterns (e.g., "? 39°C", "? 40°C")
    .replace(/\?\s*(\d+)°C/g, '≥ $1°C')
}




