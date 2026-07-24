import {
  matchesSearch,
  filterEntries,
  sortEntries,
  EMPTY_PIPELINE_FILTERS,
} from '../pipelineTableUtils'
import type { PipelineEntry } from '../types'

function entry(overrides: Partial<PipelineEntry>): PipelineEntry {
  return {
    id: 'id-' + Math.random().toString(36).slice(2),
    practiceName: 'Test Practice',
    practiceAddress: null,
    townCity: null,
    pcnName: null,
    listSize: null,
    estimatedFeeGbp: null,
    contactName: null,
    contactRole: null,
    contactEmail: null,
    status: 'Enquiry',
    dateEnquiry: null,
    dateDemoBooked: null,
    dateDemoCompleted: null,
    dateProposalSent: null,
    dateOnboardingFormSent: null,
    dateSaasAgreementSent: null,
    dateSaasAgreementSigned: null,
    dateDpaSent: null,
    dateDpaSigned: null,
    dateContractStart: null,
    freeTrial: false,
    trialEndDate: null,
    annualValueGbp: null,
    invoiceGeneratedAt: null,
    invoicePaidAt: null,
    contractVariantLabel: null,
    contractVariantId: null,
    contractVariant: null,
    notes: null,
    linkedSurgeryId: null,
    linkedSurgery: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('matchesSearch', () => {
  const e = entry({
    practiceName: 'Pinhoe Surgery',
    pcnName: 'Outer Exeter',
    townCity: 'Exeter',
    contactName: 'Amy Taplin',
    contactEmail: 'amy@pinhoe.nhs.uk',
  })

  it('matches on practice name, PCN, town, contact name and email, case-insensitively', () => {
    expect(matchesSearch(e, 'pinhoe')).toBe(true)
    expect(matchesSearch(e, 'OUTER')).toBe(true)
    expect(matchesSearch(e, 'exeter')).toBe(true)
    expect(matchesSearch(e, 'taplin')).toBe(true)
    expect(matchesSearch(e, 'nhs.uk')).toBe(true)
    expect(matchesSearch(e, 'westbank')).toBe(false)
  })

  it('matches everything on an empty or whitespace query', () => {
    expect(matchesSearch(e, '')).toBe(true)
    expect(matchesSearch(e, '   ')).toBe(true)
  })
})

describe('filterEntries', () => {
  const active = entry({ practiceName: 'Active', status: 'ProposalSent' })
  const contracted = entry({ practiceName: 'Contracted One', status: 'Contracted' })
  const archived = entry({
    practiceName: 'Quiet Practice',
    status: 'DemoCompleted',
    archivedAt: '2026-06-01T00:00:00Z',
  })
  const all = [active, contracted, archived]

  it('hides archived entries by default', () => {
    const result = filterEntries(all, EMPTY_PIPELINE_FILTERS)
    expect(result.map((e) => e.practiceName)).toEqual(['Active', 'Contracted One'])
  })

  it('includes archived entries when showArchived is on', () => {
    const result = filterEntries(all, { ...EMPTY_PIPELINE_FILTERS, showArchived: true })
    expect(result).toHaveLength(3)
  })

  it('filters by selected statuses', () => {
    const result = filterEntries(all, { ...EMPTY_PIPELINE_FILTERS, statuses: ['Contracted'] })
    expect(result.map((e) => e.practiceName)).toEqual(['Contracted One'])
  })

  it('combines status filter, archived visibility and search', () => {
    const result = filterEntries(all, {
      statuses: ['DemoCompleted'],
      showArchived: true,
      query: 'quiet',
    })
    expect(result.map((e) => e.practiceName)).toEqual(['Quiet Practice'])
  })
})

describe('sortEntries', () => {
  const a = entry({ practiceName: 'Alpha', listSize: 5000, dateEnquiry: '2026-06-01T00:00:00Z' })
  const b = entry({ practiceName: 'Bravo', listSize: 12000, dateEnquiry: '2026-03-01T00:00:00Z' })
  const c = entry({ practiceName: 'Charlie', listSize: null, dateEnquiry: null })
  const list = [a, b, c]

  it('returns the input order when no sort is set', () => {
    expect(sortEntries(list, null)).toEqual(list)
  })

  it('sorts by name in both directions', () => {
    expect(sortEntries(list, { key: 'name', desc: false }).map((e) => e.practiceName)).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ])
    expect(sortEntries(list, { key: 'name', desc: true }).map((e) => e.practiceName)).toEqual([
      'Charlie',
      'Bravo',
      'Alpha',
    ])
  })

  it('sorts numeric fields with nulls last in either direction', () => {
    expect(sortEntries(list, { key: 'listSize', desc: false }).map((e) => e.practiceName)).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ])
    expect(sortEntries(list, { key: 'listSize', desc: true }).map((e) => e.practiceName)).toEqual([
      'Bravo',
      'Alpha',
      'Charlie',
    ])
  })

  it('sorts days-in-pipeline with the oldest enquiry as the most days', () => {
    // desc = most days first = earliest enquiry first; null enquiry always last
    expect(sortEntries(list, { key: 'days', desc: true }).map((e) => e.practiceName)).toEqual([
      'Bravo',
      'Alpha',
      'Charlie',
    ])
    expect(sortEntries(list, { key: 'days', desc: false }).map((e) => e.practiceName)).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ])
  })

  it('only treats free-trial entries as having a trial end date', () => {
    const trial = entry({ practiceName: 'Trial', freeTrial: true, trialEndDate: '2026-08-01T00:00:00Z' })
    const staleDate = entry({ practiceName: 'Stale', freeTrial: false, trialEndDate: '2026-01-01T00:00:00Z' })
    const result = sortEntries([staleDate, trial], { key: 'trialEnds', desc: false })
    expect(result.map((e) => e.practiceName)).toEqual(['Trial', 'Stale'])
  })

  it('does not mutate the input array', () => {
    const copy = [...list]
    sortEntries(list, { key: 'name', desc: true })
    expect(list).toEqual(copy)
  })
})
