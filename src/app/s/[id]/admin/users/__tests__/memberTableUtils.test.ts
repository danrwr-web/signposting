import { computeMemberStats, filterMembers, matchesSearch, sortMembers } from '@/app/s/[id]/admin/users/memberTableUtils'
import { EMPTY_FILTERS, hasHandbookAccess } from '@/app/s/[id]/admin/users/types'
import type { Membership } from '@/app/s/[id]/admin/users/types'

const NOW = new Date('2026-07-01T12:00:00Z')

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

function makeMembership(
  overrides: Partial<Membership> & { id: string; user?: Partial<Membership['user']> }
): Membership {
  const { user, ...rest } = overrides
  return {
    role: 'STANDARD',
    ...rest,
    user: {
      id: `user-${overrides.id}`,
      email: `${overrides.id}@example.com`,
      name: null,
      defaultSurgeryId: null,
      ...user,
    },
  }
}

const alice = makeMembership({ id: 'm-alice', role: 'ADMIN', user: { name: 'Alice Adams' } })
const bob = makeMembership({ id: 'm-bob', adminToolkitWrite: true, user: { name: 'Bob Brown' } })
const cara = makeMembership({ id: 'm-cara', user: { name: 'Cara Cole' } })
const dave = makeMembership({ id: 'm-dave', user: { email: 'dave@nhs.net' } })
const members = [alice, bob, cara, dave]

const lastActiveData: Record<string, string | null> = {
  'user-m-alice': daysAgo(2),
  'user-m-bob': daysAgo(45),
  'user-m-cara': null,
  'user-m-dave': daysAgo(30),
}

describe('hasHandbookAccess', () => {
  it('is always true for practice admins', () => {
    expect(hasHandbookAccess(alice)).toBe(true)
  })

  it('requires the explicit grant for standard users', () => {
    expect(hasHandbookAccess(bob)).toBe(true)
    expect(hasHandbookAccess(cara)).toBe(false)
  })
})

describe('matchesSearch', () => {
  it('matches on name case-insensitively', () => {
    expect(matchesSearch(alice, 'alice ad')).toBe(true)
  })

  it('matches on email', () => {
    expect(matchesSearch(dave, 'dave@nhs')).toBe(true)
    expect(matchesSearch(alice, 'dave@nhs')).toBe(false)
  })

  it('matches everything on empty query', () => {
    expect(matchesSearch(cara, '  ')).toBe(true)
  })
})

describe('filterMembers', () => {
  it('returns all members with no filters or search', () => {
    expect(filterMembers(members, EMPTY_FILTERS, '', lastActiveData, NOW)).toHaveLength(4)
  })

  it('filters to practice admins only', () => {
    const result = filterMembers(members, { ...EMPTY_FILTERS, adminsOnly: true }, '', lastActiveData, NOW)
    expect(result.map((m) => m.id)).toEqual(['m-alice'])
  })

  it('filters to effective handbook access (admins + explicit grants)', () => {
    const result = filterMembers(members, { ...EMPTY_FILTERS, handbookOnly: true }, '', lastActiveData, NOW)
    expect(result.map((m) => m.id)).toEqual(['m-alice', 'm-bob'])
  })

  it('filters never-active members', () => {
    const result = filterMembers(members, { ...EMPTY_FILTERS, activity: 'never' }, '', lastActiveData, NOW)
    expect(result.map((m) => m.id)).toEqual(['m-cara'])
  })

  it('inactive30 includes never-active and honours the 30-day boundary', () => {
    // dave is exactly 30 days ago (not < 30 days) so counts as inactive
    const result = filterMembers(members, { ...EMPTY_FILTERS, activity: 'inactive30' }, '', lastActiveData, NOW)
    expect(result.map((m) => m.id)).toEqual(['m-bob', 'm-cara', 'm-dave'])
  })

  it('combines filters and search with AND semantics', () => {
    const result = filterMembers(
      members,
      { ...EMPTY_FILTERS, handbookOnly: true, activity: 'inactive30' },
      'bob',
      lastActiveData,
      NOW
    )
    expect(result.map((m) => m.id)).toEqual(['m-bob'])
  })
})

describe('sortMembers', () => {
  it('sorts by name ascending, falling back to email when name is null', () => {
    const result = sortMembers(members, { key: 'name', direction: 'asc' }, lastActiveData)
    expect(result.map((m) => m.id)).toEqual(['m-alice', 'm-bob', 'm-cara', 'm-dave'])
  })

  it('sorts by name descending', () => {
    const result = sortMembers(members, { key: 'name', direction: 'desc' }, lastActiveData)
    expect(result.map((m) => m.id)).toEqual(['m-dave', 'm-cara', 'm-bob', 'm-alice'])
  })

  it('sorts by last active descending with never-active last', () => {
    const result = sortMembers(members, { key: 'lastActive', direction: 'desc' }, lastActiveData)
    expect(result.map((m) => m.id)).toEqual(['m-alice', 'm-dave', 'm-bob', 'm-cara'])
  })

  it('sorts by last active ascending with never-active still last', () => {
    const result = sortMembers(members, { key: 'lastActive', direction: 'asc' }, lastActiveData)
    expect(result.map((m) => m.id)).toEqual(['m-bob', 'm-dave', 'm-alice', 'm-cara'])
  })

  it('breaks last-active ties by name', () => {
    const tied: Record<string, string | null> = {
      'user-m-alice': daysAgo(1),
      'user-m-bob': daysAgo(1),
      'user-m-cara': null,
      'user-m-dave': null,
    }
    const result = sortMembers(members, { key: 'lastActive', direction: 'desc' }, tied)
    expect(result.map((m) => m.id)).toEqual(['m-alice', 'm-bob', 'm-cara', 'm-dave'])
  })
})

describe('computeMemberStats', () => {
  it('computes totals from the full list', () => {
    expect(computeMemberStats(members, lastActiveData, NOW)).toEqual({
      total: 4,
      practiceAdmins: 1,
      activeLast30Days: 1,
      neverActive: 1,
    })
  })

  it('treats members missing from lastActiveData as never active', () => {
    expect(computeMemberStats([dave], {}, NOW).neverActive).toBe(1)
  })
})
