import { DAILY_DOSE_XP } from './constants'

export function calculateSessionXp(params: { correctCount: number; questionsAttempted: number }): number {
  const base = DAILY_DOSE_XP.sessionBase
  const perCorrect = DAILY_DOSE_XP.perCorrect
  const score = base + params.correctCount * perCorrect
  return Math.min(score, DAILY_DOSE_XP.maxPerSession)
}

export function calculateAccuracy(correctCount: number, questionCount: number): number {
  if (questionCount <= 0) return 0
  return correctCount / questionCount
}

export function calculateStreak(dates: Date[], weekdayOnly: boolean, reference: Date = new Date()): number {
  if (dates.length === 0) return 0
  const uniqueDays = Array.from(new Set(dates.map((d) => toDayKey(d)))).sort().reverse()
  let streak = 0

  let cursor = toStartOfDay(reference)
  if (!uniqueDays.includes(toDayKey(cursor))) {
    cursor = previousStreakDay(cursor, weekdayOnly)
  }

  while (uniqueDays.includes(toDayKey(cursor))) {
    streak += 1
    cursor = previousStreakDay(cursor, weekdayOnly)
  }

  return streak
}

function toDayKey(date: Date): string {
  return toStartOfDay(date).toISOString().slice(0, 10)
}

function toStartOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function previousStreakDay(date: Date, weekdayOnly: boolean): Date {
  const prev = new Date(date)
  do {
    prev.setDate(prev.getDate() - 1)
  } while (weekdayOnly && isWeekend(prev))
  return prev
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}
