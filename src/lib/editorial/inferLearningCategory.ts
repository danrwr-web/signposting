/**
 * Infers matching learning categories and subsections for a card
 * based on the prompt text used to generate it.
 *
 * Strategy:
 * 1. Exact subsection name match (case-insensitive) → high confidence
 * 2. All words of a subsection name found in prompt (partial match) → low confidence
 * 3. Returns ALL matches above threshold (a card can belong to multiple categories)
 */

export interface LearningCategoryRef {
  id: string
  name: string
  slug: string
  subsections: string[]
}

export interface InferredCategory {
  categoryId: string
  categoryName: string
  subsection: string
  confidence: 'high' | 'low'
}

/**
 * Normalises text for comparison: lowercase, collapse whitespace, strip
 * punctuation that varies between symptom name variants.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Splits a subsection name into meaningful keywords (3+ chars),
 * filtering stop-words that don't add signal.
 */
const STOP_WORDS = new Set([
  'and', 'or', 'the', 'for', 'in', 'of', 'a', 'an', 'to', 'with',
  'from', 'by', 'at', 'on', 'is', 'are', 'was', 'were', 'be',
  'non', 'not', 'no', 'men', 'women', 'man', 'woman',
])

function keywords(text: string): string[] {
  return normalise(text)
    .split(' ')
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}

/**
 * Infers ALL matching learning categories and subsections for a given prompt.
 * Returns high-confidence matches first, then low-confidence.
 * Deduplicates by categoryId + subsection pair.
 *
 * @param promptText - The free-text prompt used to generate the card
 * @param categories - Active learning categories loaded from DB
 * @returns Array of matches (empty = no matches found)
 */
export function inferLearningCategories(
  promptText: string,
  categories: LearningCategoryRef[],
): InferredCategory[] {
  if (!promptText || !categories.length) return []

  const normalisedPrompt = normalise(promptText)
  const promptWords = new Set(normalisedPrompt.split(' ').filter((w) => w.length >= 3))

  const highMatches: InferredCategory[] = []
  const lowMatches: InferredCategory[] = []
  const seen = new Set<string>()

  for (const category of categories) {
    for (const subsection of category.subsections) {
      const normSub = normalise(subsection)
      const key = `${category.id}::${subsection}`

      // High confidence: exact subsection name appears in prompt
      if (normalisedPrompt.includes(normSub)) {
        if (!seen.has(key)) {
          seen.add(key)
          highMatches.push({
            categoryId: category.id,
            categoryName: category.name,
            subsection,
            confidence: 'high',
          })
        }
        continue
      }

      // Low confidence: most keywords of the subsection name appear in prompt
      const kws = keywords(subsection)
      if (kws.length === 0) continue

      const matchCount = kws.filter((kw) => promptWords.has(kw)).length
      const score = matchCount / kws.length

      if (score >= 0.6 && matchCount >= 1 && !seen.has(key)) {
        seen.add(key)
        lowMatches.push({
          categoryId: category.id,
          categoryName: category.name,
          subsection,
          confidence: 'low',
        })
      }
    }
  }

  return [...highMatches, ...lowMatches]
}

/**
 * Convenience wrapper that returns just the single best match.
 * Kept for backwards compatibility — prefer inferLearningCategories.
 */
export function inferLearningCategory(
  promptText: string,
  categories: LearningCategoryRef[],
): InferredCategory | null {
  const results = inferLearningCategories(promptText, categories)
  return results[0] ?? null
}
