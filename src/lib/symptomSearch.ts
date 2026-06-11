/**
 * Shared symptom search matching, safe for both client and server use.
 *
 * Search must run over the same content the user actually sees. Symptom
 * instructions are displayed from `instructionsHtml`, falling back to the
 * legacy `instructions` markdown only when no HTML exists (see
 * InstructionView). Surgery overrides and AI customisation write
 * `instructionsHtml`/`instructionsJson` but never the legacy `instructions`
 * field, so matching on `instructions` directly would search the base
 * symptom's original text — content the surgery may have replaced.
 */

export interface SearchableSymptomFields {
  name: string
  briefInstruction?: string | null
  instructions?: string | null
  instructionsHtml?: string | null
  // Precomputed server-side by buildEffectiveSymptoms; present on slim payloads
  // where instructionsHtml is omitted. Takes precedence when set.
  searchText?: string | null
}

/**
 * Reduce stored (already-sanitised) HTML to plain text for search matching.
 * Deliberately lightweight — this is for matching, not rendering.
 */
export function stripHtmlForSearch(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The lowercase text a symptom should be searchable by: its name, brief
 * instruction, and the instructions the user would actually be shown.
 */
export function getSymptomSearchText(symptom: SearchableSymptomFields): string {
  if (symptom.searchText?.trim()) {
    return symptom.searchText.toLowerCase()
  }
  const displayedInstructions = symptom.instructionsHtml?.trim()
    ? stripHtmlForSearch(symptom.instructionsHtml)
    : symptom.instructions || ''
  return [symptom.name, stripHtmlForSearch(symptom.briefInstruction || ''), displayedInstructions]
    .join('\n')
    .toLowerCase()
}

/** Case-insensitive substring match against the symptom's searchable text. */
export function symptomMatchesSearch(symptom: SearchableSymptomFields, query: string): boolean {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return true
  return getSymptomSearchText(symptom).includes(trimmed)
}
