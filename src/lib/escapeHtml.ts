/**
 * HTML entity escaping.
 *
 * Deliberately dependency-free and separate from `sanitizeHtml.ts`: that
 * module pulls in the `sanitize-html` library at import time, and the
 * highlighting pipeline (bundled into the symptom listing pages) only needs
 * these three replacements. `sanitizeHtml.ts` re-exports `escapeHtml` so
 * existing import sites keep working.
 */

/**
 * Escapes plain text for use inside an HTML text node, so tag-shaped literal
 * text (e.g. "use <code> here") displays verbatim instead of being parsed as
 * markup. Use before feeding plain-text fields into HTML.
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
