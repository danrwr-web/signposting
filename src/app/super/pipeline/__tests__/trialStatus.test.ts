import { getTrialStatus, formatDaysRemaining } from '../trialStatus'
import type { PipelineEntry } from '../types'

type TrialFields = Pick<PipelineEntry, 'freeTrial' | 'trialEndDate' | 'invoiceGeneratedAt' | 'status'>

const NOW = new Date('2026-07-24T10:30:00')

function entry(overrides: Partial<TrialFields> = {}): TrialFields {
  return {
    freeTrial: true,
    trialEndDate: null,
    invoiceGeneratedAt: null,
    status: 'Contracted',
    ...overrides,
  }
}

describe('getTrialStatus', () => {
  it('returns onTrial=false when freeTrial is not set', () => {
    const result = getTrialStatus(entry({ freeTrial: false, trialEndDate: '2026-08-01' }), NOW)
    expect(result).toEqual({ onTrial: false, daysRemaining: null, urgency: 'none', invoiceDue: false })
  })

  it('treats Lost entries as not on trial', () => {
    const result = getTrialStatus(entry({ status: 'Lost', trialEndDate: '2026-07-01' }), NOW)
    expect(result.onTrial).toBe(false)
    expect(result.invoiceDue).toBe(false)
  })

  it('flags a trial with no end date but never marks invoice due', () => {
    const result = getTrialStatus(entry(), NOW)
    expect(result).toEqual({ onTrial: true, daysRemaining: null, urgency: 'none', invoiceDue: false })
  })

  it('reports no urgency when the trial ends in more than 30 days', () => {
    const result = getTrialStatus(entry({ trialEndDate: '2026-09-07' }), NOW) // 45 days
    expect(result.daysRemaining).toBe(45)
    expect(result.urgency).toBe('none')
    expect(result.invoiceDue).toBe(false)
  })

  it('reports warning urgency within 30 days', () => {
    const result = getTrialStatus(entry({ trialEndDate: '2026-08-13' }), NOW) // 20 days
    expect(result.daysRemaining).toBe(20)
    expect(result.urgency).toBe('warning')
    expect(result.invoiceDue).toBe(false)
  })

  it('reports critical urgency and invoice due within 7 days', () => {
    const result = getTrialStatus(entry({ trialEndDate: '2026-07-29' }), NOW) // 5 days
    expect(result.daysRemaining).toBe(5)
    expect(result.urgency).toBe('critical')
    expect(result.invoiceDue).toBe(true)
  })

  it('counts a trial ending today as 0 days left, not expired', () => {
    const result = getTrialStatus(entry({ trialEndDate: '2026-07-24' }), NOW)
    expect(result.daysRemaining).toBe(0)
    expect(result.urgency).toBe('critical')
    expect(result.invoiceDue).toBe(true)
  })

  it('reports expired urgency and invoice due after the end date', () => {
    const result = getTrialStatus(entry({ trialEndDate: '2026-07-14' }), NOW) // 10 days ago
    expect(result.daysRemaining).toBe(-10)
    expect(result.urgency).toBe('expired')
    expect(result.invoiceDue).toBe(true)
  })

  it('does not mark invoice due once an invoice has been generated', () => {
    const result = getTrialStatus(
      entry({ trialEndDate: '2026-07-14', invoiceGeneratedAt: '2026-07-15' }),
      NOW
    )
    expect(result.urgency).toBe('expired')
    expect(result.invoiceDue).toBe(false)
  })
})

describe('formatDaysRemaining', () => {
  it('formats future, present, and past day counts', () => {
    expect(formatDaysRemaining(45)).toBe('45 days left')
    expect(formatDaysRemaining(1)).toBe('1 day left')
    expect(formatDaysRemaining(0)).toBe('ends today')
    expect(formatDaysRemaining(-1)).toBe('ended 1 day ago')
    expect(formatDaysRemaining(-10)).toBe('ended 10 days ago')
  })
})
