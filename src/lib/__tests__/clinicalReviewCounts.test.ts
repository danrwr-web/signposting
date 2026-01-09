import { computeClinicalReviewCounts, getClinicalReviewKey } from '@/lib/clinicalReviewCounts'

describe('computeClinicalReviewCounts', () => {
  it('partitions symptoms so pending+approved+changesRequested == all', () => {
    const symptoms = [
      { id: 'a', ageGroup: 'Adult' as any },
      { id: 'b', ageGroup: 'Adult' as any },
      { id: 'c', ageGroup: 'Adult' as any },
      { id: 'd', ageGroup: 'Adult' as any },
    ]

    // a: approved (exact key)
    // b: changes requested (legacy null key)
    // c: no status row -> pending
    // d: pending (explicit)
    const map = new Map<string, any>([
      [getClinicalReviewKey('a', 'Adult'), { symptomId: 'a', ageGroup: 'Adult', status: 'APPROVED' }],
      [getClinicalReviewKey('b', null), { symptomId: 'b', ageGroup: null, status: 'CHANGES_REQUIRED' }],
      [getClinicalReviewKey('d', 'Adult'), { symptomId: 'd', ageGroup: 'Adult', status: 'PENDING' }],
    ])

    const counts = computeClinicalReviewCounts(symptoms, map)
    expect(counts.pending + counts.approved + counts.changesRequested).toBe(counts.all)
    expect(counts.all).toBe(4)
    expect(counts.approved).toBe(1)
    expect(counts.changesRequested).toBe(1)
    expect(counts.pending).toBe(2)
  })
})

