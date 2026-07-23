export interface Membership {
  id: string
  role: string
  adminToolkitWrite?: boolean
  user: {
    id: string
    email: string
    name: string | null
    defaultSurgeryId: string | null
  }
}

export interface Surgery {
  id: string
  name: string
  slug: string | null
  users: Membership[]
}

export type PendingAction = { type: 'remove-access'; userId: string; email: string }

export type SortKey = 'name' | 'lastActive'

export interface SortState {
  key: SortKey
  direction: 'asc' | 'desc'
}

export type ActivityFilter = 'all' | 'inactive30' | 'never'

export interface MemberFilters {
  adminsOnly: boolean
  handbookOnly: boolean
  activity: ActivityFilter
}

export const EMPTY_FILTERS: MemberFilters = {
  adminsOnly: false,
  handbookOnly: false,
  activity: 'all',
}

export interface MemberStats {
  total: number
  practiceAdmins: number
  activeLast30Days: number
  neverActive: number
}

/** Practice admins always have Handbook write access; others need the explicit grant. */
export function hasHandbookAccess(membership: Membership): boolean {
  return membership.role === 'ADMIN' || membership.adminToolkitWrite === true
}
