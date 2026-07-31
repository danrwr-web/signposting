import 'server-only'

// Keep in sync with the client-side pre-check in
// src/components/rich-text/toolbar/ImagePopover.tsx.
export const MAX_SYMPTOM_IMAGE_BYTES = 2 * 1024 * 1024 // 2MB

const SYMPTOM_IMAGE_ID_RE = /\/api\/symptom-images\/([a-z0-9]+)/gi

/**
 * Collect the SymptomImage ids referenced by one or more content blobs
 * (instruction HTML, or stringified variants JSON). Used when practice
 * content is pushed into the shared base library: referenced surgery-scoped
 * images must be made global, or the serving route 404s for every other
 * practice.
 */
export function extractSymptomImageIds(...contents: Array<string | null | undefined>): string[] {
  const ids = new Set<string>()
  for (const content of contents) {
    if (!content) continue
    for (const match of content.matchAll(SYMPTOM_IMAGE_ID_RE)) {
      ids.add(match[1])
    }
  }
  return Array.from(ids)
}
