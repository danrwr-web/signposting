import type { SessionUser } from '@/lib/rbac'

export type SurgeryMembershipRole = 'ADMIN' | 'STANDARD'

export type AdminToolkitCategoryVisibility = {
  id: string
  parentCategoryId: string | null
  visibilityMode: 'ALL' | 'ROLES' | 'USERS' | 'ROLES_OR_USERS'
  visibilityRoles: SurgeryMembershipRole[]
  visibleUserIds: string[]
}

export type AdminToolkitItemEditGrant = {
  principalType: 'USER' | 'ROLE'
  userId: string | null
  role: SurgeryMembershipRole | null
}

export type AdminToolkitItemForPermissions = {
  id: string
  surgeryId: string
  categoryId: string | null
  editGrants: AdminToolkitItemEditGrant[]
}

export function isSuperuser(user: SessionUser): boolean {
  return user.globalRole === 'SUPERUSER'
}

export function getSurgeryRole(user: SessionUser, surgeryId: string): SurgeryMembershipRole | null {
  if (isSuperuser(user)) return null
  const membership = user.memberships.find((m) => m.surgeryId === surgeryId)
  if (!membership) return null
  return membership.role === 'ADMIN' ? 'ADMIN' : 'STANDARD'
}

export function canAccessAdminToolkitAdminDashboard(user: SessionUser, surgeryId: string): boolean {
  if (isSuperuser(user)) return true
  const membership = user.memberships.find((m) => m.surgeryId === surgeryId)
  return membership?.role === 'ADMIN'
}

export function canViewAdminCategory(user: SessionUser, category: AdminToolkitCategoryVisibility, surgeryId: string): boolean {
  if (isSuperuser(user)) return true
  if (canAccessAdminToolkitAdminDashboard(user, surgeryId)) return true

  const role = getSurgeryRole(user, surgeryId)
  const roles = category.visibilityRoles ?? []
  const users = category.visibleUserIds ?? []

  switch (category.visibilityMode) {
    case 'ALL':
      return true
    case 'ROLES':
      return role ? roles.includes(role) : false
    case 'USERS':
      return users.includes(user.id)
    case 'ROLES_OR_USERS':
      return (role ? roles.includes(role) : false) || users.includes(user.id)
    default:
      return false
  }
}

export function computeViewableAdminCategoryIds(
  user: SessionUser,
  surgeryId: string,
  categories: AdminToolkitCategoryVisibility[],
): Set<string> {
  if (isSuperuser(user) || canAccessAdminToolkitAdminDashboard(user, surgeryId)) {
    return new Set(categories.map((c) => c.id))
  }

  const byId = new Map(categories.map((c) => [c.id, c]))
  const memo = new Map<string, boolean>()

  const canViewEffective = (categoryId: string): boolean => {
    const cached = memo.get(categoryId)
    if (cached !== undefined) return cached

    const cat = byId.get(categoryId)
    if (!cat) {
      memo.set(categoryId, false)
      return false
    }

    // Category-level restrictions inherit down the tree: if you cannot see a parent,
    // you cannot see its subcategories or items either.
    const direct = canViewAdminCategory(user, cat, surgeryId)
    if (!direct) {
      memo.set(categoryId, false)
      return false
    }

    if (!cat.parentCategoryId) {
      memo.set(categoryId, true)
      return true
    }

    // Align with the category tree builder: if a parent reference is missing (e.g. deleted),
    // treat this category as a root rather than hiding it.
    if (!byId.has(cat.parentCategoryId)) {
      memo.set(categoryId, true)
      return true
    }

    const parentOk = canViewEffective(cat.parentCategoryId)
    memo.set(categoryId, parentOk)
    return parentOk
  }

  const allowed = new Set<string>()
  for (const c of categories) {
    if (canViewEffective(c.id)) allowed.add(c.id)
  }
  return allowed
}

export function filterAdminToolkitCategoriesTree<T extends { id: string; children?: T[] }>(
  categories: T[],
  viewableCategoryIds: Set<string>,
): T[] {
  const walk = (cat: T): T | null => {
    if (!viewableCategoryIds.has(cat.id)) return null
    const children = cat.children ? cat.children.map(walk).filter((x): x is T => x !== null) : undefined
    return { ...cat, children }
  }
  return categories.map(walk).filter((x): x is T => x !== null)
}

export function filterAdminToolkitItemsByViewableCategories<T extends { categoryId: string | null }>(
  items: T[],
  viewableCategoryIds: Set<string>,
): T[] {
  return items.filter((it) => it.categoryId == null || viewableCategoryIds.has(it.categoryId))
}

export function canViewAdminItem(
  user: SessionUser,
  item: { surgeryId: string; categoryId: string | null },
  viewableCategoryIds: Set<string>,
): boolean {
  if (isSuperuser(user) || canAccessAdminToolkitAdminDashboard(user, item.surgeryId)) return true
  if (item.categoryId == null) return true
  return viewableCategoryIds.has(item.categoryId)
}

export function canEditAdminItem(user: SessionUser, item: AdminToolkitItemForPermissions): boolean {
  if (isSuperuser(user) || canAccessAdminToolkitAdminDashboard(user, item.surgeryId)) return true

  const role = getSurgeryRole(user, item.surgeryId)
  for (const g of item.editGrants ?? []) {
    if (g.principalType === 'USER' && g.userId && g.userId === user.id) return true
    if (g.principalType === 'ROLE' && g.role && role && g.role === role) return true
  }
  return false
}

