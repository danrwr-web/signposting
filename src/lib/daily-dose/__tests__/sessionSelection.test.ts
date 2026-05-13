import { selectSessionCards } from '@/lib/daily-dose/sessionSelection'
import type { DailyDoseCardPayload } from '@/lib/daily-dose/types'

function makeCard(overrides: Partial<DailyDoseCardPayload> & { id: string; batchId?: string | null }): DailyDoseCardPayload & { batchId?: string | null } {
  return {
    title: `Card ${overrides.id}`,
    topicId: 'topic-1',
    topicName: 'Test Topic',
    roleScope: ['ADMIN'],
    contentBlocks: [],
    sources: [],
    version: 1,
    status: 'PUBLISHED',
    ...overrides,
  }
}

const now = new Date('2026-05-13T12:00:00Z')
const yesterday = new Date('2026-05-12T12:00:00Z')

describe('selectSessionCards', () => {
  it('returns new/unseen cards when no card states exist', () => {
    const cards = [makeCard({ id: 'a' }), makeCard({ id: 'b' }), makeCard({ id: 'c' })]
    const result = selectSessionCards({
      eligibleCards: cards,
      cardStates: new Map(),
      targetCount: 3,
      now,
    })
    expect(result.map((c) => c.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('prioritises due cards over new cards', () => {
    const cards = [makeCard({ id: 'due-1' }), makeCard({ id: 'new-1' }), makeCard({ id: 'new-2' })]
    const states = new Map([
      ['due-1', { dueAt: yesterday, incorrectStreak: 0, lastReviewedAt: null }],
    ])
    const result = selectSessionCards({
      eligibleCards: cards,
      cardStates: states,
      targetCount: 3,
      now,
    })
    expect(result[0].id).toBe('due-1')
  })

  it('sorts new cards by toolkit relevance when scores are provided', () => {
    const cards = [
      makeCard({ id: 'low', batchId: null }),
      makeCard({ id: 'high', batchId: null }),
      makeCard({ id: 'mid', batchId: null }),
      makeCard({ id: 'none', batchId: null }),
    ]
    const relevanceScores = new Map([
      ['high', 0.9],
      ['mid', 0.5],
      ['low', 0.1],
    ])
    const result = selectSessionCards({
      eligibleCards: cards,
      cardStates: new Map(),
      targetCount: 3,
      now,
      cardRelevanceScores: relevanceScores,
    })
    expect(result.map((c) => c.id)).toEqual(['high', 'mid', 'low'])
  })

  it('applies anti-repetition penalty for recently seen categories', () => {
    const cards = [
      makeCard({ id: 'recent-cat', batchId: null }),
      makeCard({ id: 'fresh-cat', batchId: null }),
      makeCard({ id: 'filler-1', batchId: null }),
      makeCard({ id: 'filler-2', batchId: null }),
    ]
    const relevanceScores = new Map([
      ['recent-cat', 0.6],
      ['fresh-cat', 0.5],
      ['filler-1', 0.1],
      ['filler-2', 0.0],
    ])
    const recentCategoryIds = new Set(['cat-a'])
    const cardCategoryIds = new Map([
      ['recent-cat', ['cat-a']],
      ['fresh-cat', ['cat-b']],
      ['filler-1', ['cat-c']],
      ['filler-2', ['cat-d']],
    ])

    const result = selectSessionCards({
      eligibleCards: cards,
      cardStates: new Map(),
      targetCount: 3,
      now,
      cardRelevanceScores: relevanceScores,
      recentCategoryIds,
      cardCategoryIds,
    })
    // recent-cat has 0.6 - 0.3 penalty = 0.3, fresh-cat has 0.5 - 0 = 0.5
    // fresh-cat should win because penalty drops recent-cat below it
    expect(result.length).toBe(3)
    expect(result[0].id).toBe('fresh-cat')
  })

  it('prefers batches with higher average relevance', () => {
    const cards = [
      makeCard({ id: 'b1-1', batchId: 'batch-low' }),
      makeCard({ id: 'b1-2', batchId: 'batch-low' }),
      makeCard({ id: 'b1-3', batchId: 'batch-low' }),
      makeCard({ id: 'b2-1', batchId: 'batch-high' }),
      makeCard({ id: 'b2-2', batchId: 'batch-high' }),
      makeCard({ id: 'b2-3', batchId: 'batch-high' }),
    ]
    const relevanceScores = new Map([
      ['b1-1', 0.1],
      ['b1-2', 0.1],
      ['b1-3', 0.1],
      ['b2-1', 0.9],
      ['b2-2', 0.8],
      ['b2-3', 0.7],
    ])
    const result = selectSessionCards({
      eligibleCards: cards,
      cardStates: new Map(),
      targetCount: 3,
      now,
      cardRelevanceScores: relevanceScores,
    })
    expect(result.every((c) => c.batchId === 'batch-high')).toBe(true)
  })

  it('still works when no relevance scores are provided (backward compatible)', () => {
    const cards = [
      makeCard({ id: 'a', batchId: null }),
      makeCard({ id: 'b', batchId: null }),
      makeCard({ id: 'c', batchId: null }),
    ]
    const result = selectSessionCards({
      eligibleCards: cards,
      cardStates: new Map(),
      targetCount: 3,
      now,
    })
    expect(result.length).toBe(3)
  })
})
