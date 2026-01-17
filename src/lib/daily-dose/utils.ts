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
