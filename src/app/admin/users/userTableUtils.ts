import type { SortState, User, UserFilters, UserStats } from './types'

export { getUserInitials } from '@/lib/getUserInitials'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export function matchesSearch(user: User, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  if (user.name?.toLowerCase().includes(needle)) return true
  if (user.email.toLowerCase().includes(needle)) return true
  return user.memberships.some((m) => m.surgery.name.toLowerCase().includes(needle))
}

export function filterUsers(
  users: User[],
  filters: UserFilters,
  searchQuery: string,
  lastActiveData: Record<string, string | null>,
  now: Date
): User[] {
  return users.filter((user) => {
    if (!matchesSearch(user, searchQuery)) return false
    if (filters.adminsOnly && user.globalRole !== 'SUPERUSER') return false
    if (filters.testOnly && !user.isTestUser) return false
    if (filters.noSurgeries && user.memberships.length > 0) return false

    if (filters.activity !== 'all') {
      const lastActiveIso = lastActiveData[user.id] ?? null
      if (filters.activity === 'never') {
        if (lastActiveIso !== null) return false
      } else {
        // 'inactive30': not seen in the last 30 days (includes never active)
        if (lastActiveIso !== null && now.getTime() - new Date(lastActiveIso).getTime() < THIRTY_DAYS_MS) {
          return false
        }
      }
    }

    return true
  })
}

export function sortUsers(
  users: User[],
  sort: SortState,
  lastActiveData: Record<string, string | null>
): User[] {
  const byName = (a: User, b: User) => {
    const nameA = (a.name || a.email).toLowerCase()
    const nameB = (b.name || b.email).toLowerCase()
    return nameA.localeCompare(nameB)
  }

  const copy = [...users]
  copy.sort((a, b) => {
    if (sort.key === 'name') {
      const cmp = byName(a, b)
      return sort.direction === 'desc' ? -cmp : cmp
    }

    // lastActive: null (never active) always sorts last, whichever direction
    const aIso = lastActiveData[a.id] ?? null
    const bIso = lastActiveData[b.id] ?? null
    if (aIso === null && bIso === null) return byName(a, b)
    if (aIso === null) return 1
    if (bIso === null) return -1
    const cmp = new Date(aIso).getTime() - new Date(bIso).getTime()
    if (cmp === 0) return byName(a, b)
    return sort.direction === 'desc' ? -cmp : cmp
  })
  return copy
}

export function computeStats(
  users: User[],
  lastActiveData: Record<string, string | null>,
  now: Date
): UserStats {
  let systemAdmins = 0
  let activeLast30Days = 0
  let neverActive = 0

  for (const user of users) {
    if (user.globalRole === 'SUPERUSER') systemAdmins++
    const lastActiveIso = lastActiveData[user.id] ?? null
    if (lastActiveIso === null) {
      neverActive++
    } else if (now.getTime() - new Date(lastActiveIso).getTime() < THIRTY_DAYS_MS) {
      activeLast30Days++
    }
  }

  return { total: users.length, systemAdmins, activeLast30Days, neverActive }
}
