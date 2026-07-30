import 'server-only'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { canAccessAdminToolkitAdminDashboard, canViewAdminItem, computeViewableAdminCategoryIds } from '@/lib/adminToolkitPermissions'

export type ActionError =
  | { code: 'UNAUTHENTICATED'; message: string }
  | { code: 'FORBIDDEN'; message: string }
  | { code: 'FEATURE_DISABLED'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string; fieldErrors?: Record<string, string> }
  | { code: 'CATEGORY_NOT_EMPTY'; message: string }
  | { code: 'STALE'; message: string }
  | { code: 'UNKNOWN'; message: string }

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError }

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'root'
    if (!result[key]) result[key] = issue.message
  }
  return result
}

export async function requireAdminToolkitWrite(surgeryId: string): Promise<ActionResult<{ surgeryId: string; userId: string; isSuperuser: boolean }>> {
  try {
    const user = await requireSurgeryAccess(surgeryId)
    const enabled = await isFeatureEnabledForSurgery(surgeryId, 'admin_toolkit')
    if (!enabled) {
      return { ok: false, error: { code: 'FEATURE_DISABLED', message: 'Practice Handbook is not enabled for this surgery.' } }
    }
    if (!canAccessAdminToolkitAdminDashboard(user, surgeryId)) {
      return { ok: false, error: { code: 'FORBIDDEN', message: 'You do not have access to manage Practice Handbook.' } }
    }
    return { ok: true, data: { surgeryId, userId: user.id, isSuperuser: user.globalRole === 'SUPERUSER' } }
  } catch {
    return { ok: false, error: { code: 'UNAUTHENTICATED', message: 'You must be signed in.' } }
  }
}

export async function requireAdminToolkitView(surgeryId: string): Promise<ActionResult<{ surgeryId: string }>> {
  try {
    await requireSurgeryAccess(surgeryId)
    const enabled = await isFeatureEnabledForSurgery(surgeryId, 'admin_toolkit')
    if (!enabled) {
      return { ok: false, error: { code: 'FEATURE_DISABLED', message: 'Practice Handbook is not enabled for this surgery.' } }
    }
    return { ok: true, data: { surgeryId } }
  } catch {
    return { ok: false, error: { code: 'UNAUTHENTICATED', message: 'You must be signed in.' } }
  }
}

/**
 * Whether the user can view the category an admin item sits in, applying the
 * same category-visibility rules the handbook UI uses. Shared by the item
 * edit gate and the image-serving route so restricted-category content stays
 * restricted everywhere.
 */
export async function canUserViewAdminItemInCategory(
  user: Awaited<ReturnType<typeof requireSurgeryAccess>>,
  surgeryId: string,
  categoryId: string | null,
): Promise<boolean> {
  const cats = await prisma.adminCategory.findMany({
    where: { surgeryId, deletedAt: null },
    select: {
      id: true,
      parentCategoryId: true,
      visibilityMode: true,
      visibilityRoles: true,
      visibleUsers: { select: { userId: true } },
    },
  })
  const viewableCategoryIds = computeViewableAdminCategoryIds(
    user,
    surgeryId,
    cats.map((c) => ({
      id: c.id,
      parentCategoryId: c.parentCategoryId,
      visibilityMode: c.visibilityMode,
      visibilityRoles: (c.visibilityRoles ?? []) as Array<'ADMIN' | 'STANDARD'>,
      visibleUserIds: (c.visibleUsers ?? []).map((u) => u.userId),
    })),
  )
  return canViewAdminItem(user, { surgeryId, categoryId }, viewableCategoryIds)
}

export async function requireAdminToolkitItemEdit(
  surgeryId: string,
  itemId: string,
): Promise<ActionResult<{ surgeryId: string; itemId: string; userId: string; canManage: boolean; isSuperuser: boolean }>> {
  try {
    const user = await requireSurgeryAccess(surgeryId)
    const isSuperuser = user.globalRole === 'SUPERUSER'
    const enabled = await isFeatureEnabledForSurgery(surgeryId, 'admin_toolkit')
    if (!enabled) {
      return { ok: false, error: { code: 'FEATURE_DISABLED', message: 'Practice Handbook is not enabled for this surgery.' } }
    }

    const canManage = canAccessAdminToolkitAdminDashboard(user, surgeryId)
    const item = await prisma.adminItem.findFirst({
      where: { id: itemId, surgeryId, deletedAt: null, type: { in: ['PAGE', 'LIST'] } },
      select: { id: true, categoryId: true },
    })
    if (!item) return { ok: false, error: { code: 'NOT_FOUND', message: 'Item not found.' } }

    // Enforce view permissions even for editors (no bypass via direct action calls).
    if (!(await canUserViewAdminItemInCategory(user, surgeryId, item.categoryId))) {
      return { ok: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this item.' } }
    }

    if (canManage) {
      return { ok: true, data: { surgeryId, itemId, userId: user.id, canManage: true, isSuperuser } }
    }

    const membership = user.memberships.find((m) => m.surgeryId === surgeryId)
    const role = membership?.role === 'ADMIN' ? 'ADMIN' : 'STANDARD'

    const grant = await prisma.adminItemEditGrant.findFirst({
      where: {
        surgeryId,
        adminItemId: itemId,
        OR: [
          { principalType: 'USER', userId: user.id },
          { principalType: 'ROLE', role },
        ],
      },
      select: { id: true },
    })
    if (!grant) {
      return { ok: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to edit this item.' } }
    }

    return { ok: true, data: { surgeryId, itemId, userId: user.id, canManage: false, isSuperuser } }
  } catch {
    return { ok: false, error: { code: 'UNAUTHENTICATED', message: 'You must be signed in.' } }
  }
}
