import type { DailyDoseCardPayload } from './types'
import { DAILY_DOSE_ROLES, type DailyDoseRole } from './constants'

export function normaliseRoleScope(value: unknown): DailyDoseRole[] {
  if (!Array.isArray(value)) return []
  return value.filter((role): role is DailyDoseRole => DAILY_DOSE_ROLES.includes(role))
}

export function hasRoleScope(roleScope: DailyDoseRole[], role: DailyDoseRole): boolean {
  return roleScope.includes(role)
}

export function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const nextKey = key(item)
    if (seen.has(nextKey)) return false
    seen.add(nextKey)
    return true
  })
}

export function toCardPayload(card: {
  id: string
  title: string
  topicId: string
  topic: { name: string }
  roleScope: unknown
  contentBlocks: unknown
  interactions?: unknown
  sources: unknown
  reviewByDate: Date | null
  version: number
  status: string
  tags: unknown
  batchId?: string | null
}): DailyDoseCardPayload & { batchId?: string | null } {
  return {
    id: card.id,
    title: card.title,
    topicId: card.topicId,
    topicName: card.topic?.name,
    roleScope: normaliseRoleScope(card.roleScope),
    contentBlocks: Array.isArray(card.contentBlocks) ? (card.contentBlocks as DailyDoseCardPayload['contentBlocks']) : [],
    interactions: Array.isArray(card.interactions)
      ? (card.interactions as DailyDoseCardPayload['interactions'])
      : [],
    sources: Array.isArray(card.sources) ? (card.sources as DailyDoseCardPayload['sources']) : [],
    reviewByDate: card.reviewByDate ? card.reviewByDate.toISOString() : null,
    version: card.version,
    status: card.status,
    tags: Array.isArray(card.tags) ? (card.tags as string[]) : undefined,
    batchId: card.batchId ?? null,
  }
}
