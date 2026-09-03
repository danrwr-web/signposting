/**
 * Deliberate Daily Dose content-library reset.
 *
 * Cards created before this timestamp are retained as legacy/test content so
 * previous experiments remain inspectable, but they are excluded from the
 * normal editorial library and from learner sessions. New card creation starts
 * from a clean library without deleting historical data.
 */
export const DAILY_DOSE_LIBRARY_RESET_AT = new Date('2026-09-03T21:09:32.000Z')

export function isLegacyDailyDoseCard(createdAt: Date): boolean {
  return createdAt < DAILY_DOSE_LIBRARY_RESET_AT
}
