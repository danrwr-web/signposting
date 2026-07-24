import { PipelineEntry, PipelineStatus, PIPELINE_STATUSES } from './types'

export type PipelineSortKey =
  | 'name'
  | 'listSize'
  | 'fee'
  | 'status'
  | 'contractStart'
  | 'trialEnds'
  | 'days'

export interface PipelineSort {
  key: PipelineSortKey
  desc: boolean
}

export interface PipelineFilters {
  statuses: PipelineStatus[]
  showArchived: boolean
  query: string
}

export const EMPTY_PIPELINE_FILTERS: PipelineFilters = {
  statuses: [],
  showArchived: false,
  query: '',
}

export function matchesSearch(entry: PipelineEntry, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [entry.practiceName, entry.pcnName, entry.townCity, entry.contactName, entry.contactEmail]
    .filter((v): v is string => !!v)
    .some((v) => v.toLowerCase().includes(needle))
}

export function filterEntries(entries: PipelineEntry[], filters: PipelineFilters): PipelineEntry[] {
  return entries.filter((e) => {
    if (!filters.showArchived && e.archivedAt) return false
    if (filters.statuses.length > 0 && !filters.statuses.includes(e.status)) return false
    return matchesSearch(e, filters.query)
  })
}

/** Nulls sort last in either direction; practice name breaks ties. */
function compareNullable(a: number | null, b: number | null, desc: boolean): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return desc ? b - a : a - b
}

function dateValue(iso: string | null): number | null {
  return iso ? new Date(iso).getTime() : null
}

export function sortEntries(entries: PipelineEntry[], sort: PipelineSort | null): PipelineEntry[] {
  if (!sort) return entries
  const { key, desc } = sort
  return [...entries].sort((a, b) => {
    let cmp: number
    switch (key) {
      case 'name':
        cmp = a.practiceName.localeCompare(b.practiceName) * (desc ? -1 : 1)
        break
      case 'listSize':
        cmp = compareNullable(a.listSize, b.listSize, desc)
        break
      case 'fee':
        cmp = compareNullable(a.estimatedFeeGbp, b.estimatedFeeGbp, desc)
        break
      case 'status':
        cmp =
          (PIPELINE_STATUSES.indexOf(a.status) - PIPELINE_STATUSES.indexOf(b.status)) *
          (desc ? -1 : 1)
        break
      case 'contractStart':
        cmp = compareNullable(dateValue(a.dateContractStart), dateValue(b.dateContractStart), desc)
        break
      case 'trialEnds':
        cmp = compareNullable(
          a.freeTrial ? dateValue(a.trialEndDate) : null,
          b.freeTrial ? dateValue(b.trialEndDate) : null,
          desc
        )
        break
      case 'days':
        // More days in pipeline = earlier enquiry date, so invert the date comparison
        cmp = compareNullable(dateValue(a.dateEnquiry), dateValue(b.dateEnquiry), !desc)
        break
    }
    return cmp !== 0 ? cmp : a.practiceName.localeCompare(b.practiceName)
  })
}
