import {
  calculateAccuracyPercent,
  deriveMasteryState,
  updateProgressAccumulator,
} from '@/lib/daily-dose/mastery'

describe('Daily Dose mastery helpers', () => {
  it('calculates percentage accuracy', () => {
    expect(calculateAccuracyPercent(8, 10)).toBe(80)
    expect(calculateAccuracyPercent(0, 0)).toBe(0)
  })

  it('derives secure only when reinforced and above threshold', () => {
    expect(
      deriveMasteryState({
        attemptedQuestions: 10,
        correctQuestions: 8,
        reinforcedAt: new Date('2026-05-07T08:00:00Z'),
      })
    ).toBe('SECURE')

    expect(
      deriveMasteryState({
        attemptedQuestions: 10,
        correctQuestions: 8,
        reinforcedAt: null,
      })
    ).toBe('IN_PROGRESS')
  })

  it('accumulates progress over sessions', () => {
    const next = updateProgressAccumulator({
      current: {
        attemptedQuestions: 10,
        correctQuestions: 7,
        reinforcedAt: null,
      },
      sessionAttemptedQuestions: 5,
      sessionCorrectQuestions: 4,
      reinforcedAt: new Date('2026-05-07T08:00:00Z'),
    })

    expect(next.attemptedQuestions).toBe(15)
    expect(next.correctQuestions).toBe(11)
    expect(next.reinforcedAt).not.toBeNull()
  })
})
