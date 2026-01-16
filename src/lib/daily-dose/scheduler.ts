import { DAILY_DOSE_LEITNER_INTERVALS } from './constants'

export type DailyDoseReviewState = {
  box: number
  intervalDays: number
  dueAt: Date
  correctStreak: number
  incorrectStreak: number
}

export function clampBox(box: number): number {
  if (box < 1) return 1
  if (box > DAILY_DOSE_LEITNER_INTERVALS.length) return DAILY_DOSE_LEITNER_INTERVALS.length
  return box
}

export function intervalForBox(box: number): number {
  const clamped = clampBox(box)
  return DAILY_DOSE_LEITNER_INTERVALS[clamped - 1] ?? DAILY_DOSE_LEITNER_INTERVALS[0]
}

export function calculateDueAt(from: Date, intervalDays: number): Date {
  const dueAt = new Date(from)
  dueAt.setDate(dueAt.getDate() + intervalDays)
  dueAt.setHours(8, 0, 0, 0)
  return dueAt
}

export function applyReviewOutcome(params: {
  currentBox: number
  correct: boolean
  now?: Date
  correctStreak?: number
  incorrectStreak?: number
}): DailyDoseReviewState {
  const now = params.now ?? new Date()
  const correctStreak = params.correctStreak ?? 0
  const incorrectStreak = params.incorrectStreak ?? 0

  const nextBox = params.correct ? clampBox(params.currentBox + 1) : clampBox(params.currentBox - 1)
  const intervalDays = intervalForBox(nextBox)
  const dueAt = calculateDueAt(now, intervalDays)

  return {
    box: nextBox,
    intervalDays,
    dueAt,
    correctStreak: params.correct ? correctStreak + 1 : 0,
    incorrectStreak: params.correct ? 0 : incorrectStreak + 1,
  }
}
