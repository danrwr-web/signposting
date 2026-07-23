import { computeStats, filterUsers, getUserInitials, matchesSearch, sortUsers } from '@/app/admin/users/userTableUtils'
import { EMPTY_FILTERS } from '@/app/admin/users/types'
import type { User } from '@/app/admin/users/types'

const NOW = new Date('2026-07-01T12:00:00Z')

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

function makeUser(overrides: Partial<User> & { id: string }): User {
  return {
    email: `${overrides.id}@example.com`,
    name: null,
    globalRole: 'USER',
    defaultSurgeryId: null,
    createdAt: new Date('2026-01-01'),
    isTestUser: false,
    symptomUsageLimit: null,
    symptomsUsed: 0,
    memberships: [],
    defaultSurgery: null,
    ...overrides,
  }
}

const membership = (id: string, surgeryName: string, role = 'STANDARD') => ({
  id,
  role,
  surgery: { id: `surgery-${id}`, name: surgeryName },
})

const alice = makeUser({ id: 'alice', name: 'Alice Adams', memberships: [membership('m1', 'Mount Pleasant Health Centre', 'ADMIN')] })
const bob = makeUser({ id: 'bob', name: 'Bob Brown', globalRole: 'SUPERUSER' })
const cara = makeUser({ id: 'cara', name: 'Cara Cole', isTestUser: true, memberships: [membership('m2', 'Ide Lane Surgery')] })
const dave = makeUser({ id: 'dave', name: null, email: 'dave@nhs.net' })
const users = [alice, bob, cara, dave]

const lastActiveData: Record<string, string | null> = {
  alice: daysAgo(2),
  bob: daysAgo(45),
  cara: null,
  dave: daysAgo(30),
}

describe('getUserInitials', () => {
  it('uses first and last name initials', () => {
    expect(getUserInitials('Alice Mary Adams', 'x@y.com')).toBe('AA')
  })

  it('uses single-name initial', () => {
    expect(getUserInitials('Alice', 'x@y.com')).toBe('A')
  })

  it('falls back to the email initial', () => {
    expect(getUserInitials(null, 'dave@nhs.net')).toBe('D')
  })
})

describe('matchesSearch', () => {
  it('matches on name case-insensitively', () => {
    expect(matchesSearch(alice, 'alice ad')).toBe(true)
  })

  it('matches on email', () => {
    expect(matchesSearch(dave, 'dave@nhs')).toBe(true)
  })

  it('matches on surgery name', () => {
    expect(matchesSearch(alice, 'mount pleasant')).toBe(true)
    expect(matchesSearch(bob, 'mount pleasant')).toBe(false)
  })

  it('matches everything on empty query', () => {
    expect(matchesSearch(alice, '   ')).toBe(true)
  })
})

describe('filterUsers', () => {
  it('returns all users with no filters or search', () => {
    expect(filterUsers(users, EMPTY_FILTERS, '', lastActiveData, NOW)).toHaveLength(4)
  })

  it('filters to system admins only', () => {
    const result = filterUsers(users, { ...EMPTY_FILTERS, adminsOnly: true }, '', lastActiveData, NOW)
    expect(result.map((u) => u.id)).toEqual(['bob'])
  })

  it('filters to test users only', () => {
    const result = filterUsers(users, { ...EMPTY_FILTERS, testOnly: true }, '', lastActiveData, NOW)
    expect(result.map((u) => u.id)).toEqual(['cara'])
  })

  it('filters to users without surgery memberships', () => {
    const result = filterUsers(users, { ...EMPTY_FILTERS, noSurgeries: true }, '', lastActiveData, NOW)
    expect(result.map((u) => u.id)).toEqual(['bob', 'dave'])
  })

  it('filters never-active users', () => {
    const result = filterUsers(users, { ...EMPTY_FILTERS, activity: 'never' }, '', lastActiveData, NOW)
    expect(result.map((u) => u.id)).toEqual(['cara'])
  })

  it('inactive30 includes never-active users and honours the 30-day boundary', () => {
    // dave is exactly 30 days ago (not < 30 days) so counts as inactive
    const result = filterUsers(users, { ...EMPTY_FILTERS, activity: 'inactive30' }, '', lastActiveData, NOW)
    expect(result.map((u) => u.id)).toEqual(['bob', 'cara', 'dave'])
  })

  it('combines filters with AND semantics', () => {
    const result = filterUsers(
      users,
      { ...EMPTY_FILTERS, noSurgeries: true, activity: 'inactive30' },
      '',
      lastActiveData,
      NOW
    )
    expect(result.map((u) => u.id)).toEqual(['bob', 'dave'])
  })

  it('applies search alongside filters', () => {
    const result = filterUsers(users, { ...EMPTY_FILTERS, noSurgeries: true }, 'dave', lastActiveData, NOW)
    expect(result.map((u) => u.id)).toEqual(['dave'])
  })
})

describe('sortUsers', () => {
  it('sorts by name ascending, falling back to email when name is null', () => {
    const result = sortUsers(users, { key: 'name', direction: 'asc' }, lastActiveData)
    expect(result.map((u) => u.id)).toEqual(['alice', 'bob', 'cara', 'dave'])
  })

  it('sorts by name descending', () => {
    const result = sortUsers(users, { key: 'name', direction: 'desc' }, lastActiveData)
    expect(result.map((u) => u.id)).toEqual(['dave', 'cara', 'bob', 'alice'])
  })

  it('sorts by last active descending with never-active last', () => {
    const result = sortUsers(users, { key: 'lastActive', direction: 'desc' }, lastActiveData)
    expect(result.map((u) => u.id)).toEqual(['alice', 'dave', 'bob', 'cara'])
  })

  it('sorts by last active ascending with never-active still last', () => {
    const result = sortUsers(users, { key: 'lastActive', direction: 'asc' }, lastActiveData)
    expect(result.map((u) => u.id)).toEqual(['bob', 'dave', 'alice', 'cara'])
  })

  it('breaks last-active ties by name', () => {
    const tied: Record<string, string | null> = {
      alice: daysAgo(1),
      bob: daysAgo(1),
      cara: null,
      dave: null,
    }
    const result = sortUsers(users, { key: 'lastActive', direction: 'desc' }, tied)
    expect(result.map((u) => u.id)).toEqual(['alice', 'bob', 'cara', 'dave'])
  })
})

describe('computeStats', () => {
  it('computes totals from the full list', () => {
    expect(computeStats(users, lastActiveData, NOW)).toEqual({
      total: 4,
      systemAdmins: 1,
      activeLast30Days: 1,
      neverActive: 1,
    })
  })

  it('treats users missing from lastActiveData as never active', () => {
    expect(computeStats([dave], {}, NOW).neverActive).toBe(1)
  })
})
