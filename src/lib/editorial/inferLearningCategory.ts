/**
 * Infers the best-matching learning category and subsection for a card
 * based on the prompt text used to generate it.
 *
 * Strategy:
 * 1. Exact subsection name match (case-insensitive) → high confidence
 * 2. All words of a subsection name found in prompt (partial match) → low confidence
 * 3. No match → null (user assigns manually)
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
 * Infers the most likely learning category and subsection for a given prompt.
 *
 * @param promptText - The free-text prompt used to generate the card
 * @param categories - Active learning categories loaded from DB
 * @returns The best match, or null if no match found
 */
export function inferLearningCategory(
  promptText: string,
  categories: LearningCategoryRef[],
): InferredCategory | null {
  if (!promptText || !categories.length) return null

  const normalisedPrompt = normalise(promptText)
  const promptWords = new Set(normalisedPrompt.split(' ').filter((w) => w.length >= 3))

  let bestHighConfidence: InferredCategory | null = null
  let bestLowConfidence: InferredCategory | null = null
  let bestLowScore = 0

  for (const category of categories) {
    for (const subsection of category.subsections) {
      const normSub = normalise(subsection)

      // High confidence: exact subsection name appears in prompt
      if (normalisedPrompt.includes(normSub)) {
        if (!bestHighConfidence) {
          bestHighConfidence = {
            categoryId: category.id,
            categoryName: category.name,
            subsection,
            confidence: 'high',
          }
          // Keep searching — prefer longer (more specific) matches
        } else {
          // Prefer the more specific (longer) match
          const existingLen = normalise(bestHighConfidence.subsection).length
          if (normSub.length > existingLen) {
            bestHighConfidence = {
              categoryId: category.id,
              categoryName: category.name,
              subsection,
              confidence: 'high',
            }
          }
        }
        continue
      }

      // Low confidence: most keywords of the subsection name appear in prompt
      const kws = keywords(subsection)
      if (kws.length === 0) continue

      const matchCount = kws.filter((kw) => promptWords.has(kw)).length
      const score = matchCount / kws.length

      if (score >= 0.6 && matchCount >= 1 && score > bestLowScore) {
        bestLowScore = score
        bestLowConfidence = {
          categoryId: category.id,
          categoryName: category.name,
          subsection,
          confidence: 'low',
        }
      }
    }
  }

  return bestHighConfidence ?? bestLowConfidence ?? null
}
