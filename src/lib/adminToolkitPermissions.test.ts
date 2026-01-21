import {
  canAccessAdminToolkitAdminDashboard,
  canEditAdminItem,
  computeViewableAdminCategoryIds,
  filterAdminToolkitItemsByViewableCategories,
} from './adminToolkitPermissions'
import type { SessionUser } from './rbac'

function makeUser(opts: {
  id: string
  globalRole?: 'USER' | 'SUPERUSER'
  memberships?: Array<{ surgeryId: string; role: 'ADMIN' | 'STANDARD' }>
}): SessionUser {
  return {
    id: opts.id,
    email: `${opts.id}@example.com`,
    globalRole: opts.globalRole ?? 'USER',
    isTestUser: false,
    symptomsUsed: 0,
    memberships: (opts.memberships ?? []).map((m) => ({ surgeryId: m.surgeryId, role: m.role })),
  }
}

describe('adminToolkitPermissions', () => {
  test('standard user cannot view restricted category', () => {
    const surgeryId = 's1'
    const user = makeUser({ id: 'u1', memberships: [{ surgeryId, role: 'STANDARD' }] })
    const categories = [
      {
        id: 'c1',
        parentCategoryId: null,
        visibilityMode: 'ROLES' as const,
        visibilityRoles: ['ADMIN'] as const,
        visibleUserIds: [],
      },
      {
        id: 'c2',
        parentCategoryId: null,
        visibilityMode: 'ALL' as const,
        visibilityRoles: [],
        visibleUserIds: [],
      },
    ]

    const viewable = computeViewableAdminCategoryIds(user, surgeryId, categories)
    expect(viewable.has('c1')).toBe(false)
    expect(viewable.has('c2')).toBe(true)
  })

  test('admin can view/edit and can access admin dashboard', () => {
    const surgeryId = 's1'
    const user = makeUser({ id: 'uAdmin', memberships: [{ surgeryId, role: 'ADMIN' }] })
    expect(canAccessAdminToolkitAdminDashboard(user, surgeryId)).toBe(true)

    const item = {
      id: 'i1',
      surgeryId,
      categoryId: 'c1',
      editGrants: [],
    }
    expect(canEditAdminItem(user, item)).toBe(true)
  })

  test('standard user with item grant can edit that item but cannot access admin dashboard', () => {
    const surgeryId = 's1'
    const user = makeUser({ id: 'u1', memberships: [{ surgeryId, role: 'STANDARD' }] })
    expect(canAccessAdminToolkitAdminDashboard(user, surgeryId)).toBe(false)

    const itemGranted = {
      id: 'i1',
      surgeryId,
      categoryId: 'c1',
      editGrants: [{ principalType: 'USER' as const, userId: 'u1', role: null }],
    }
    const itemNotGranted = {
      id: 'i2',
      surgeryId,
      categoryId: 'c1',
      editGrants: [],
    }

    expect(canEditAdminItem(user, itemGranted)).toBe(true)
    expect(canEditAdminItem(user, itemNotGranted)).toBe(false)
  })

  test('search results exclude restricted categories', () => {
    const surgeryId = 's1'
    const user = makeUser({ id: 'u1', memberships: [{ surgeryId, role: 'STANDARD' }] })

    const categories = [
      {
        id: 'cAdminOnly',
        parentCategoryId: null,
        visibilityMode: 'ROLES' as const,
        visibilityRoles: ['ADMIN'] as const,
        visibleUserIds: [],
      },
      {
        id: 'cAll',
        parentCategoryId: null,
        visibilityMode: 'ALL' as const,
        visibilityRoles: [],
        visibleUserIds: [],
      },
    ]

    const viewable = computeViewableAdminCategoryIds(user, surgeryId, categories)
    const items = [
      { id: 'i1', categoryId: 'cAdminOnly', title: 'secret' },
      { id: 'i2', categoryId: 'cAll', title: 'public' },
      { id: 'i3', categoryId: null, title: 'uncategorised' },
    ]

    const filtered = filterAdminToolkitItemsByViewableCategories(items, viewable)
    expect(filtered.map((x) => x.id).sort()).toEqual(['i2', 'i3'])
  })
})

