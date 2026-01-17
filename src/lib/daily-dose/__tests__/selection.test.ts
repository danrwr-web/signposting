import { pickCoreCard } from '@/lib/daily-dose/selection'

describe('Daily Dose session selection', () => {
  it('prioritises due cards over new cards', () => {
    const dueCards = [{ id: 'due-1' }]
    const newCards = [{ id: 'new-1' }]
    const core = pickCoreCard({ dueCards, newCards })
    expect(core).toEqual(dueCards[0])
  })

  it('falls back to new cards when no due cards exist', () => {
    const core = pickCoreCard({ dueCards: [], newCards: [{ id: 'new-1' }] })
    expect(core).toEqual({ id: 'new-1' })
  })
})
