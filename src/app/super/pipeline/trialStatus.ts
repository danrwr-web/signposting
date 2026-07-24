import type { PipelineEntry } from './types'

export type TrialUrgency = 'expired' | 'critical' | 'warning' | 'none'

export interface TrialStatus {
  /** Entry is marked as a free trial (and not Lost) */
  onTrial: boolean
  /** Whole days until the trial ends; 0 = ends today, negative = ended. Null when no end date is set. */
  daysRemaining: number | null
  urgency: TrialUrgency
  /** Trial has ended (or ends within 7 days) and no invoice has been generated yet */
  invoiceDue: boolean
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

/** Whole-day difference between two dates, comparing calendar days in local time. */
function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

export function getTrialStatus(
  entry: Pick<PipelineEntry, 'freeTrial' | 'trialEndDate' | 'invoiceGeneratedAt' | 'status'>,
  now: Date = new Date()
): TrialStatus {
  const onTrial = entry.freeTrial && entry.status !== 'Lost'
  if (!onTrial) {
    return { onTrial: false, daysRemaining: null, urgency: 'none', invoiceDue: false }
  }
  if (!entry.trialEndDate) {
    return { onTrial: true, daysRemaining: null, urgency: 'none', invoiceDue: false }
  }

  const daysRemaining = daysBetween(now, new Date(entry.trialEndDate))
  const urgency: TrialUrgency =
    daysRemaining < 0 ? 'expired' : daysRemaining <= 7 ? 'critical' : daysRemaining <= 30 ? 'warning' : 'none'
  const invoiceDue = daysRemaining <= 7 && !entry.invoiceGeneratedAt

  return { onTrial: true, daysRemaining, urgency, invoiceDue }
}

export function formatDaysRemaining(days: number): string {
  if (days === 0) return 'ends today'
  if (days === 1) return '1 day left'
  if (days > 1) return `${days} days left`
  if (days === -1) return 'ended 1 day ago'
  return `ended ${-days} days ago`
}
