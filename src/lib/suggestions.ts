import type { BadgeColor } from '@/components/ui'
import type { SuggestionStatus, SuggestionType } from '@/lib/api-contracts'

export const SUGGESTION_TYPE_LABELS: Record<SuggestionType, string> = {
  FEATURE: 'Feature request',
  IMPROVEMENT: 'Improvement',
  BUG: 'Bug report',
  SYMPTOM_CONTENT: 'Symptom content',
}

export const SUGGESTION_TYPE_BADGE_COLORS: Record<SuggestionType, BadgeColor> = {
  FEATURE: 'blue',
  IMPROVEMENT: 'green',
  BUG: 'red',
  SYMPTOM_CONTENT: 'amber',
}

export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under review',
  PLANNED: 'Planned',
  DONE: 'Done',
  DECLINED: 'Declined',
}

export const SUGGESTION_STATUS_BADGE_COLORS: Record<SuggestionStatus, BadgeColor> = {
  PENDING: 'yellow',
  UNDER_REVIEW: 'blue',
  PLANNED: 'purple',
  DONE: 'green',
  DECLINED: 'red',
}

export const SUGGESTION_STATUSES: SuggestionStatus[] = [
  'PENDING',
  'UNDER_REVIEW',
  'PLANNED',
  'DONE',
  'DECLINED',
]

export const SUGGESTION_TYPES: SuggestionType[] = [
  'FEATURE',
  'IMPROVEMENT',
  'BUG',
  'SYMPTOM_CONTENT',
]

export function formatSuggestionDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
