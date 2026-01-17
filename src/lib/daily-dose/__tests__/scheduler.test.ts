import { applyReviewOutcome, intervalForBox } from '@/lib/daily-dose/scheduler'

describe('Daily Dose scheduler', () => {
  it('moves up a box on correct answers', () => {
    const outcome = applyReviewOutcome({ currentBox: 1, correct: true, now: new Date('2026-01-16T09:00:00Z') })
    expect(outcome.box).toBe(2)
    expect(outcome.intervalDays).toBe(intervalForBox(2))
    expect(outcome.correctStreak).toBe(1)
    expect(outcome.incorrectStreak).toBe(0)
  })

  it('moves down a box on incorrect answers', () => {
    const outcome = applyReviewOutcome({ currentBox: 3, correct: false, now: new Date('2026-01-16T09:00:00Z') })
    expect(outcome.box).toBe(2)
    expect(outcome.intervalDays).toBe(intervalForBox(2))
    expect(outcome.correctStreak).toBe(0)
    expect(outcome.incorrectStreak).toBe(1)
  })
})
