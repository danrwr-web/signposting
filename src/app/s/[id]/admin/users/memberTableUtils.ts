import { hasHandbookAccess, type Membership, type MemberFilters, type MemberStats, type SortState } from './types'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export function matchesSearch(membership: Membership, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  if (membership.user.name?.toLowerCase().includes(needle)) return true
  return membership.user.email.toLowerCase().includes(needle)
}

export function filterMembers(
  memberships: Membership[],
  filters: MemberFilters,
  searchQuery: string,
  lastActiveData: Record<string, string | null>,
  now: Date
): Membership[] {
  return memberships.filter((membership) => {
    if (!matchesSearch(membership, searchQuery)) return false
    if (filters.adminsOnly && membership.role !== 'ADMIN') return false
    if (filters.handbookOnly && !hasHandbookAccess(membership)) return false

    if (filters.activity !== 'all') {
      const lastActiveIso = lastActiveData[membership.user.id] ?? null
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

export function sortMembers(
  memberships: Membership[],
  sort: SortState,
  lastActiveData: Record<string, string | null>
): Membership[] {
  const byName = (a: Membership, b: Membership) => {
    const nameA = (a.user.name || a.user.email).toLowerCase()
    const nameB = (b.user.name || b.user.email).toLowerCase()
    return nameA.localeCompare(nameB)
  }

  const copy = [...memberships]
  copy.sort((a, b) => {
    if (sort.key === 'name') {
      const cmp = byName(a, b)
      return sort.direction === 'desc' ? -cmp : cmp
    }

    // lastActive: null (never active) always sorts last, whichever direction
    const aIso = lastActiveData[a.user.id] ?? null
    const bIso = lastActiveData[b.user.id] ?? null
    if (aIso === null && bIso === null) return byName(a, b)
    if (aIso === null) return 1
    if (bIso === null) return -1
    const cmp = new Date(aIso).getTime() - new Date(bIso).getTime()
    if (cmp === 0) return byName(a, b)
    return sort.direction === 'desc' ? -cmp : cmp
  })
  return copy
}

export function computeMemberStats(
  memberships: Membership[],
  lastActiveData: Record<string, string | null>,
  now: Date
): MemberStats {
  let practiceAdmins = 0
  let activeLast30Days = 0
  let neverActive = 0

  for (const membership of memberships) {
    if (membership.role === 'ADMIN') practiceAdmins++
    const lastActiveIso = lastActiveData[membership.user.id] ?? null
    if (lastActiveIso === null) {
      neverActive++
    } else if (now.getTime() - new Date(lastActiveIso).getTime() < THIRTY_DAYS_MS) {
      activeLast30Days++
    }
  }

  return { total: memberships.length, practiceAdmins, activeLast30Days, neverActive }
}
