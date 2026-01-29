/**
 * Server-only module for fetching recently changed Practice Handbook items.
 * Respects RBAC: only returns items the user is allowed to view.
 */

import 'server-only'
import { prisma } from '@/lib/prisma'
import type { SessionUser } from '@/lib/rbac'
import {
  computeViewableAdminCategoryIds,
  filterAdminToolkitItemsByViewableCategories,
  type AdminToolkitCategoryVisibility,
} from '@/lib/adminToolkitPermissions'

/**
 * Represents a recently changed handbook item with metadata about the change type.
 */
export interface RecentlyChangedHandbookItem {
  id: string
  title: string
  categoryId: string | null
  categoryName: string | null
  changeType: 'new' | 'updated'
  changedAt: Date
}

/**
 * Default time window for "recently changed" items (14 days).
 */
export const DEFAULT_CHANGE_WINDOW_DAYS = 14

/**
 * Fetches categories for permission checking.
 */
async function fetchCategoriesForPermissions(surgeryId: string): Promise<AdminToolkitCategoryVisibility[]> {
  const categories = await prisma.adminCategory.findMany({
    where: {
      surgeryId,
      deletedAt: null,
    },
    select: {
      id: true,
      parentCategoryId: true,
      visibilityMode: true,
      visibilityRoles: true,
      visibleUsers: { select: { userId: true } },
    },
  })

  return categories.map((c) => ({
    id: c.id,
    parentCategoryId: c.parentCategoryId,
    visibilityMode: c.visibilityMode as 'ALL' | 'ROLES' | 'USERS' | 'ROLES_OR_USERS',
    visibilityRoles: c.visibilityRoles as ('ADMIN' | 'STANDARD')[],
    visibleUserIds: (c.visibleUsers ?? []).map((u) => u.userId),
  }))
}

/**
 * Fetches handbook items that have been created or updated within the specified time window.
 * Respects RBAC: only returns items in categories the user can view.
 *
 * @param user - The current session user (for RBAC filtering)
 * @param surgeryId - The surgery to scope the query to
 * @param windowDays - Number of days to look back (default: 14)
 * @returns Array of recently changed items, sorted by change date (most recent first)
 */
export async function getRecentlyChangedHandbookItems(
  user: SessionUser,
  surgeryId: string,
  windowDays: number = DEFAULT_CHANGE_WINDOW_DAYS
): Promise<RecentlyChangedHandbookItem[]> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - windowDays)

  // Fetch categories for permission checking
  const categories = await fetchCategoriesForPermissions(surgeryId)
  const viewableCategoryIds = computeViewableAdminCategoryIds(user, surgeryId, categories)

  // Fetch items created OR updated within the window
  const items = await prisma.adminItem.findMany({
    where: {
      surgeryId,
      deletedAt: null,
      OR: [
        { createdAt: { gte: cutoffDate } },
        { updatedAt: { gte: cutoffDate } },
      ],
    },
    select: {
      id: true,
      title: true,
      categoryId: true,
      createdAt: true,
      updatedAt: true,
      category: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  // Filter by viewable categories (RBAC)
  const viewableItems = filterAdminToolkitItemsByViewableCategories(items, viewableCategoryIds)

  // Map to result format, determining change type
  const results: RecentlyChangedHandbookItem[] = viewableItems.map((item) => {
    // "New" if createdAt is within the window, "Updated" otherwise
    const isNew = item.createdAt >= cutoffDate
    // Use the most recent change date
    const changedAt = item.updatedAt > item.createdAt ? item.updatedAt : item.createdAt

    return {
      id: item.id,
      title: item.title,
      categoryId: item.categoryId,
      categoryName: item.category?.name ?? null,
      changeType: isNew ? 'new' : 'updated',
      changedAt,
    }
  })

  // Sort by change date, most recent first
  results.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())

  return results
}

/**
 * Gets the count of recently changed handbook items for a surgery.
 * Respects RBAC: only counts items in categories the user can view.
 * Useful for displaying badge counts without fetching full details.
 *
 * @param user - The current session user (for RBAC filtering)
 * @param surgeryId - The surgery to scope the query to
 * @param windowDays - Number of days to look back (default: 14)
 * @returns Count of recently changed items the user can view
 */
export async function getRecentlyChangedHandbookItemsCount(
  user: SessionUser,
  surgeryId: string,
  windowDays: number = DEFAULT_CHANGE_WINDOW_DAYS
): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - windowDays)

  // Fetch categories for permission checking
  const categories = await fetchCategoriesForPermissions(surgeryId)
  const viewableCategoryIds = computeViewableAdminCategoryIds(user, surgeryId, categories)

  // Fetch items created OR updated within the window
  const items = await prisma.adminItem.findMany({
    where: {
      surgeryId,
      deletedAt: null,
      OR: [
        { createdAt: { gte: cutoffDate } },
        { updatedAt: { gte: cutoffDate } },
      ],
    },
    select: {
      id: true,
      categoryId: true,
    },
  })

  // Filter by viewable categories (RBAC)
  const viewableItems = filterAdminToolkitItemsByViewableCategories(items, viewableCategoryIds)

  return viewableItems.length
}
