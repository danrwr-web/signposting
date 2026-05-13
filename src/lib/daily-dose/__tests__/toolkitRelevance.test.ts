/**
 * Unit tests for the pure helper functions in the toolkit relevance module.
 * The main computeToolkitRelevanceScores function requires Prisma and is
 * tested via integration tests; here we test the scoring logic in isolation
 * by exercising the exported selectSessionCards with relevance inputs.
 */
import { selectSessionCards } from '@/lib/daily-dose/sessionSelection'
import type { DailyDoseCardPayload } from '@/lib/daily-dose/types'

function makeCard(id: string, batchId?: string | null): DailyDoseCardPayload & { batchId?: string | null } {
  return {
    id,
    title: `Card ${id}`,
    topicId: 'topic-1',
    topicName: 'Test Topic',
    roleScope: ['ADMIN'],
    contentBlocks: [],
    sources: [],
    version: 1,
    status: 'PUBLISHED',
    batchId: batchId ?? null,
  }
}

const now = new Date('2026-05-13T12:00:00Z')

describe('toolkit relevance integration with session selection', () => {
  it('cards with no relevance score are still selected as fallback', () => {
    const cards = [makeCard('x'), makeCard('y'), makeCard('z')]
    const result = selectSessionCards({
      eligibleCards: cards,
      cardStates: new Map(),
      targetCount: 3,
      now,
      cardRelevanceScores: new Map(),
    })
    expect(result.length).toBe(3)
  })

  it('relevance scores steer selection among new cards', () => {
    const cards = Array.from({ length: 10 }, (_, i) => makeCard(`card-${i}`))
    const scores = new Map<string, number>()
    scores.set('card-7', 1.0)
    scores.set('card-3', 0.8)
    scores.set('card-9', 0.6)

    const result = selectSessionCards({
      eligibleCards: cards,
      cardStates: new Map(),
      targetCount: 3,
      now,
      cardRelevanceScores: scores,
    })

    // The top-scored cards should appear in the result
    const ids = new Set(result.map((c) => c.id))
    expect(ids.has('card-7')).toBe(true)
    expect(ids.has('card-3')).toBe(true)
    expect(ids.has('card-9')).toBe(true)
  })

  it('anti-repetition penalty deprioritises recently seen categories', () => {
    const cards = [makeCard('fresh'), makeCard('stale')]
    const scores = new Map([
      ['fresh', 0.4],
      ['stale', 0.6],
    ])
    const recentCats = new Set(['cat-stale'])
    const cardCats = new Map([
      ['fresh', ['cat-fresh']],
      ['stale', ['cat-stale']],
    ])

    const result = selectSessionCards({
      eligibleCards: cards,
      cardStates: new Map(),
      targetCount: 1,
      now,
      cardRelevanceScores: scores,
      recentCategoryIds: recentCats,
      cardCategoryIds: cardCats,
    })

    // stale has 0.6 - 0.3 penalty = 0.3, fresh has 0.4 -> fresh wins
    expect(result[0].id).toBe('fresh')
  })
})
