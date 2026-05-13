import { prisma } from '@/lib/prisma'

const STOP_WORDS = new Set([
  'and', 'or', 'the', 'for', 'in', 'of', 'a', 'an', 'to', 'with',
  'from', 'by', 'at', 'on', 'is', 'are', 'was', 'were', 'be',
  'non', 'not', 'no', 'how', 'what', 'when', 'who', 'why', 'this',
  'that', 'their', 'they', 'them', 'you', 'your', 'our', 'has',
  'have', 'had', 'can', 'will', 'should', 'may', 'might', 'must',
])

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}

function scoreMatch(promptTokens: Set<string>, itemTitle: string): number {
  const titleTokens = tokenise(itemTitle)
  if (titleTokens.length === 0) return 0

  let matched = 0
  for (const token of titleTokens) {
    if (promptTokens.has(token)) matched++
  }

  const coverage = matched / titleTokens.length
  if (coverage < 0.5 || matched < 1) return 0
  return coverage * matched
}

/**
 * Find AdminItem pages whose titles are topically related to a card's
 * prompt text. Returns an array of matching AdminItem IDs, sorted by
 * relevance (best match first). Typically used at card generation time
 * to persist the toolkit-to-card mapping.
 */
export async function matchRelatedAdminItems(params: {
  surgeryId: string
  promptText: string
  cardTitle?: string
  maxResults?: number
}): Promise<string[]> {
  const { surgeryId, promptText, cardTitle, maxResults = 10 } = params

  const combinedText = cardTitle ? `${cardTitle} ${promptText}` : promptText
  const promptTokens = new Set(tokenise(combinedText))
  if (promptTokens.size === 0) return []

  const items = await prisma.adminItem.findMany({
    where: {
      surgeryId,
      deletedAt: null,
    },
    select: { id: true, title: true },
  })

  const scored = items
    .map((item) => ({ id: item.id, score: scoreMatch(promptTokens, item.title) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)

  return scored.map((entry) => entry.id)
}
