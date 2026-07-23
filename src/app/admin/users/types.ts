export interface User {
  id: string
  email: string
  name: string | null
  globalRole: string
  defaultSurgeryId: string | null
  createdAt: Date
  isTestUser: boolean
  symptomUsageLimit: number | null
  symptomsUsed: number
  memberships: Array<{
    id: string
    role: string
    surgery: {
      id: string
      name: string
    }
  }>
  defaultSurgery: {
    id: string
    name: string
  } | null
}

export interface Surgery {
  id: string
  name: string
}

export type PendingAction =
  | { type: 'reset-usage'; userId: string }
  | { type: 'delete-user'; userId: string; email: string }
  | { type: 'remove-membership'; userId: string; membershipId: string }

export type SortKey = 'name' | 'lastActive'

export interface SortState {
  key: SortKey
  direction: 'asc' | 'desc'
}

export type ActivityFilter = 'all' | 'inactive30' | 'never'

export interface UserFilters {
  adminsOnly: boolean
  testOnly: boolean
  noSurgeries: boolean
  activity: ActivityFilter
}

export const EMPTY_FILTERS: UserFilters = {
  adminsOnly: false,
  testOnly: false,
  noSurgeries: false,
  activity: 'all',
}

export interface UserStats {
  total: number
  systemAdmins: number
  activeLast30Days: number
  neverActive: number
}
