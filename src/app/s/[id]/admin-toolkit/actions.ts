'use server'

import { randomUUID } from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import type { AdminToolkitQuickAccessButton, AdminToolkitUiConfig } from '@/lib/adminToolkitQuickAccessShared'
import type { RoleCardsColumns, RoleCardsLayout, AdminToolkitContentJson } from '@/lib/adminToolkitContentBlocksShared'
import { upsertBlock, isHtmlEmpty } from '@/lib/adminToolkitContentBlocksShared'
import { canAccessAdminToolkitAdminDashboard, canViewAdminItem, computeViewableAdminCategoryIds } from '@/lib/adminToolkitPermissions'

type ActionError =
  | { code: 'UNAUTHENTICATED'; message: string }
  | { code: 'FORBIDDEN'; message: string }
  | { code: 'FEATURE_DISABLED'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string; fieldErrors?: Record<string, string> }
  | { code: 'CATEGORY_NOT_EMPTY'; message: string }
  | { code: 'UNKNOWN'; message: string }

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError }

function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'root'
    if (!result[key]) result[key] = issue.message
  }
  return result
}

async function requireAdminToolkitWrite(surgeryId: string): Promise<ActionResult<{ surgeryId: string; userId: string; isSuperuser: boolean }>> {
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

async function requireAdminToolkitView(surgeryId: string): Promise<ActionResult<{ surgeryId: string }>> {
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

async function requireAdminToolkitItemEdit(
  surgeryId: string,
  itemId: string,
): Promise<ActionResult<{ surgeryId: string; itemId: string; userId: string; canManage: boolean }>> {
  try {
    const user = await requireSurgeryAccess(surgeryId)
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
    if (!canViewAdminItem(user, { surgeryId, categoryId: item.categoryId }, viewableCategoryIds)) {
      return { ok: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this item.' } }
    }

    if (canManage) {
      return { ok: true, data: { surgeryId, itemId, userId: user.id, canManage: true } }
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

    return { ok: true, data: { surgeryId, itemId, userId: user.id, canManage: false } }
  } catch {
    return { ok: false, error: { code: 'UNAUTHENTICATED', message: 'You must be signed in.' } }
  }
}

const createCategoryInput = z.object({
  surgeryId: z.string().min(1),
  name: z.string().trim().min(1, 'Category name is required').max(80, 'Category name is too long'),
  parentCategoryId: z.string().min(1).nullable().optional(),
})

export async function createAdminToolkitCategory(input: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireAdminToolkitWrite((input as any)?.surgeryId)
  if (!gate.ok) return gate

  const parsed = createCategoryInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) },
    }
  }

  const { surgeryId, name, parentCategoryId } = parsed.data

  // If parentCategoryId is provided, verify it exists and belongs to this surgery
  if (parentCategoryId) {
    const parent = await prisma.adminCategory.findFirst({
      where: { id: parentCategoryId, surgeryId, deletedAt: null },
      select: { id: true },
    })
    if (!parent) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Parent category not found.' } }
    }
  }

  // Calculate orderIndex: for top-level, use max of all top-level; for subcategory, use max of siblings
  const whereClause = parentCategoryId
    ? { surgeryId, deletedAt: null, parentCategoryId }
    : { surgeryId, deletedAt: null, parentCategoryId: null }
  const max = await prisma.adminCategory.aggregate({
    where: whereClause,
    _max: { orderIndex: true },
  })
  const nextOrder = (max._max.orderIndex ?? 0) + 1

  const created = await prisma.$transaction(async (tx) => {
    const category = await tx.adminCategory.create({
      data: { surgeryId, name, orderIndex: nextOrder, parentCategoryId: parentCategoryId ?? null },
      select: { id: true },
    })
    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminCategoryId: category.id,
        action: 'CATEGORY_CREATE',
        actorUserId: gate.data.userId,
        diffJson: { name, parentCategoryId: parentCategoryId ?? null },
      },
    })
    return category
  })

  return { ok: true, data: { id: created.id } }
}

const renameCategoryInput = z.object({
  surgeryId: z.string().min(1),
  categoryId: z.string().min(1),
  name: z.string().trim().min(1, 'Category name is required').max(80, 'Category name is too long'),
})

export async function renameAdminToolkitCategory(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = renameCategoryInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) },
    }
  }

  const gate = await requireAdminToolkitWrite(parsed.data.surgeryId)
  if (!gate.ok) return gate

  const { surgeryId, categoryId, name } = parsed.data
  const before = await prisma.adminCategory.findFirst({
    where: { id: categoryId, surgeryId, deletedAt: null },
    select: { id: true, name: true },
  })
  if (!before) return { ok: false, error: { code: 'NOT_FOUND', message: 'Category not found.' } }

  await prisma.$transaction(async (tx) => {
    await tx.adminCategory.update({ where: { id: categoryId }, data: { name } })
    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminCategoryId: categoryId,
        action: 'CATEGORY_UPDATE',
        actorUserId: gate.data.userId,
        diffJson: { before: { name: before.name }, after: { name } },
      },
    })
  })

  return { ok: true, data: { id: categoryId } }
}

const setCategoryVisibilityInput = z.object({
  surgeryId: z.string().min(1),
  categoryId: z.string().min(1),
  visibilityMode: z.enum(['ALL', 'ROLES', 'USERS', 'ROLES_OR_USERS']),
  visibilityRoles: z.array(z.enum(['ADMIN', 'STANDARD'])).default([]),
  visibleUserIds: z.array(z.string().min(1)).default([]),
})

export async function setAdminToolkitCategoryVisibility(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = setCategoryVisibilityInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) },
    }
  }

  const gate = await requireAdminToolkitWrite(parsed.data.surgeryId)
  if (!gate.ok) return gate

  const { surgeryId, categoryId } = parsed.data

  const category = await prisma.adminCategory.findFirst({
    where: { id: categoryId, surgeryId, deletedAt: null },
    select: { id: true, visibilityMode: true, visibilityRoles: true, visibleUsers: { select: { userId: true } } },
  })
  if (!category) return { ok: false, error: { code: 'NOT_FOUND', message: 'Category not found.' } }

  // Normalise: only keep fields relevant to the chosen mode.
  const mode = parsed.data.visibilityMode
  const nextRoles =
    mode === 'ROLES' || mode === 'ROLES_OR_USERS' ? Array.from(new Set(parsed.data.visibilityRoles)) : ([] as Array<'ADMIN' | 'STANDARD'>)
  const nextUserIds =
    mode === 'USERS' || mode === 'ROLES_OR_USERS' ? Array.from(new Set(parsed.data.visibleUserIds)) : ([] as string[])

  // Ensure all selected users are members of this surgery.
  if (nextUserIds.length > 0) {
    const members = await prisma.userSurgery.findMany({
      where: { surgeryId, userId: { in: nextUserIds } },
      select: { userId: true },
    })
    const memberIds = new Set(members.map((m) => m.userId))
    const invalid = nextUserIds.filter((id) => !memberIds.has(id))
    if (invalid.length > 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'One or more selected people are not members of this surgery.' } }
    }
  }

  const before = {
    visibilityMode: category.visibilityMode,
    visibilityRoles: category.visibilityRoles,
    visibleUserIds: category.visibleUsers.map((u) => u.userId).sort(),
  }
  const after = { visibilityMode: mode, visibilityRoles: nextRoles, visibleUserIds: nextUserIds.slice().sort() }

  await prisma.$transaction(async (tx) => {
    await tx.adminCategory.update({
      where: { id: categoryId },
      data: {
        visibilityMode: mode,
        visibilityRoles: nextRoles as any,
      },
    })
    await tx.adminCategoryVisibleUser.deleteMany({ where: { adminCategoryId: categoryId } })
    if (nextUserIds.length > 0) {
      await tx.adminCategoryVisibleUser.createMany({
        data: nextUserIds.map((userId) => ({ surgeryId, adminCategoryId: categoryId, userId })),
      })
    }
    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminCategoryId: categoryId,
        action: 'CATEGORY_VISIBILITY_SET',
        actorUserId: gate.data.userId,
        diffJson: { before, after },
      },
    })
  })

  return { ok: true, data: { id: categoryId } }
}

const reorderCategoriesInput = z.object({
  surgeryId: z.string().min(1),
  orderedCategoryIds: z.array(z.string().min(1)).min(1),
})

export async function reorderAdminToolkitCategories(input: unknown): Promise<ActionResult<{ updated: number }>> {
  const parsed = reorderCategoriesInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) },
    }
  }

  const gate = await requireAdminToolkitWrite(parsed.data.surgeryId)
  if (!gate.ok) return gate

  const { surgeryId, orderedCategoryIds } = parsed.data

  const existing = await prisma.adminCategory.findMany({
    where: { surgeryId, deletedAt: null, id: { in: orderedCategoryIds } },
    select: { id: true },
  })
  if (existing.length !== orderedCategoryIds.length) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'One or more categories were not found.' } }
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedCategoryIds.length; i++) {
      await tx.adminCategory.update({
        where: { id: orderedCategoryIds[i] },
        data: { orderIndex: i },
      })
    }
    await tx.adminHistory.create({
      data: {
        surgeryId,
        action: 'CATEGORY_REORDER',
        actorUserId: gate.data.userId,
        diffJson: { orderedCategoryIds },
      },
    })
  })

  return { ok: true, data: { updated: orderedCategoryIds.length } }
}

const deleteCategoryInput = z.object({
  surgeryId: z.string().min(1),
  categoryId: z.string().min(1),
})

export async function deleteAdminToolkitCategory(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteCategoryInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) },
    }
  }

  const gate = await requireAdminToolkitWrite(parsed.data.surgeryId)
  if (!gate.ok) return gate

  const { surgeryId, categoryId } = parsed.data
  const category = await prisma.adminCategory.findFirst({
    where: { id: categoryId, surgeryId, deletedAt: null },
    select: { id: true, name: true, parentCategoryId: true },
  })
  if (!category) return { ok: false, error: { code: 'NOT_FOUND', message: 'Category not found.' } }

  // Check if category has items
  const itemsCount = await prisma.adminItem.count({
    where: { surgeryId, categoryId, deletedAt: null },
  })
  if (itemsCount > 0) {
    return { ok: false, error: { code: 'CATEGORY_NOT_EMPTY', message: 'You cannot delete a category that still contains items.' } }
  }

  // Check if category has children (if it's a parent)
  const childrenCount = await prisma.adminCategory.count({
    where: { surgeryId, parentCategoryId: categoryId, deletedAt: null },
  })
  if (childrenCount > 0) {
    return { ok: false, error: { code: 'CATEGORY_NOT_EMPTY', message: 'You cannot delete a category that has subcategories. Delete or move the subcategories first.' } }
  }

  await prisma.$transaction(async (tx) => {
    await tx.adminCategory.update({ where: { id: categoryId }, data: { deletedAt: new Date() } })
    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminCategoryId: categoryId,
        action: 'CATEGORY_DELETE',
        actorUserId: gate.data.userId,
        diffJson: { name: category.name },
      },
    })
  })

  return { ok: true, data: { id: categoryId } }
}

const createPageItemInput = z.object({
  surgeryId: z.string().min(1),
  title: z.string().trim().min(1, 'Title is required').max(120, 'Title is too long'),
  categoryId: z.string().min(1).nullable().optional(),
  contentHtml: z.string().optional().default(''),
  warningLevel: z.string().trim().max(40).nullable().optional(),
  lastReviewedAt: z.string().datetime().nullable().optional(),
})

export async function createAdminToolkitPageItem(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createPageItemInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) },
    }
  }

  const gate = await requireAdminToolkitWrite(parsed.data.surgeryId)
  if (!gate.ok) return gate

  const { surgeryId, title, categoryId, contentHtml, warningLevel, lastReviewedAt } = parsed.data

  const cleanedHtml = sanitizeHtml(contentHtml || '')

  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.adminItem.create({
      data: {
        surgeryId,
        categoryId: categoryId ?? null,
        type: 'PAGE',
        title,
        contentHtml: cleanedHtml,
        warningLevel: warningLevel ?? null,
        lastReviewedAt: lastReviewedAt ? new Date(lastReviewedAt) : null,
        ownerUserId: gate.data.userId,
        createdByUserId: gate.data.userId,
        updatedByUserId: gate.data.userId,
      },
      select: { id: true },
    })
    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminItemId: item.id,
        action: 'ITEM_CREATE',
        actorUserId: gate.data.userId,
        diffJson: { type: 'PAGE', title, categoryId: categoryId ?? null },
      },
    })
    return item
  })

  return { ok: true, data: { id: created.id } }
}

const createItemInput = z.object({
  surgeryId: z.string().min(1),
  type: z.enum(['PAGE', 'LIST']),
  title: z.string().trim().min(1, 'Title is required').max(120, 'Title is too long'),
  categoryId: z.string().min(1).nullable().optional(),
  contentHtml: z.string().optional().default(''), // Legacy field, kept for backwards compatibility
  introHtml: z.string().optional().default(''),
  footerHtml: z.string().optional().default(''),
  warningLevel: z.string().trim().max(40).nullable().optional(),
  lastReviewedAt: z.string().datetime().nullable().optional(),
  roleCardsBlock: z
    .object({
      id: z.string().min(1).optional(),
      title: z.string().trim().max(80).nullable().optional(),
      layout: z.enum(['grid', 'row']).optional(),
      columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
      cards: z
        .array(
          z.object({
            id: z.string().min(1).optional(),
            title: z.string().trim().max(80).default(''),
            body: z.string().max(4000).default(''),
            orderIndex: z.number().int().min(0).optional(),
          }),
        )
        .max(50)
        .default([]),
    })
    .nullable()
    .optional(),
})

export async function createAdminToolkitItem(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createItemInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) } }
  }
  const gate = await requireAdminToolkitWrite(parsed.data.surgeryId)
  if (!gate.ok) return gate

  const { surgeryId, type, title, categoryId, contentHtml, introHtml, footerHtml, warningLevel, lastReviewedAt, roleCardsBlock } = parsed.data
  
  // Build contentJson for PAGE items
  let contentJson: unknown = undefined
  if (type === 'PAGE') {
    let json: AdminToolkitContentJson = { blocks: [] }
    
    // Add INTRO_TEXT block if present
    if (introHtml && !isHtmlEmpty(introHtml)) {
      json = upsertBlock(json, { type: 'INTRO_TEXT', html: sanitizeHtml(introHtml) })
    }
    
    // Add ROLE_CARDS block if present
    if (roleCardsBlock) {
      json = upsertBlock(json, {
        type: 'ROLE_CARDS' as const,
        id: roleCardsBlock.id ?? randomUUID(),
        title: roleCardsBlock.title ?? null,
        layout: (roleCardsBlock.layout ?? 'grid') as RoleCardsLayout,
        columns: (roleCardsBlock.columns ?? 3) as RoleCardsColumns,
        cards: (roleCardsBlock.cards ?? [])
          .slice()
          .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
          .map((c, idx) => ({
            id: c.id ?? randomUUID(),
            title: (c.title ?? '').trim(),
            body: c.body ?? '',
            orderIndex: idx,
          })),
      })
    }
    
    // Add FOOTER_TEXT block if present, or use legacy contentHtml as fallback
    const footerContent = footerHtml || (contentHtml && !isHtmlEmpty(contentHtml) ? contentHtml : '')
    if (footerContent && !isHtmlEmpty(footerContent)) {
      json = upsertBlock(json, { type: 'FOOTER_TEXT', html: sanitizeHtml(footerContent) })
    }
    
    // Only set contentJson if we have blocks
    if (json.blocks && json.blocks.length > 0) {
      contentJson = json as any // Prisma JSON type
    }
  }
  
  // Keep legacy contentHtml for backwards compatibility (fallback rendering)
  const cleanedHtml = type === 'PAGE' ? sanitizeHtml(contentHtml || '') : null

  const created = await prisma.$transaction(async (tx) => {
    const item = await tx.adminItem.create({
      data: {
        surgeryId,
        categoryId: categoryId ?? null,
        type,
        title,
        contentHtml: cleanedHtml,
        contentJson: contentJson as any, // Prisma JSON type
        warningLevel: warningLevel ?? null,
        lastReviewedAt: lastReviewedAt ? new Date(lastReviewedAt) : null,
        ownerUserId: gate.data.userId,
        createdByUserId: gate.data.userId,
        updatedByUserId: gate.data.userId,
      },
      select: { id: true },
    })
    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminItemId: item.id,
        action: 'ITEM_CREATE',
        actorUserId: gate.data.userId,
        diffJson: { type, title, categoryId: categoryId ?? null },
      },
    })
    return item
  })

  return { ok: true, data: { id: created.id } }
}

const updatePageItemInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
  title: z.string().trim().min(1, 'Title is required').max(120, 'Title is too long'),
  categoryId: z.string().min(1).nullable().optional(),
  contentHtml: z.string().optional().default(''),
  warningLevel: z.string().trim().max(40).nullable().optional(),
  lastReviewedAt: z.string().datetime().nullable().optional(),
})

export async function updateAdminToolkitPageItem(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = updatePageItemInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) },
    }
  }

  const { surgeryId, itemId } = parsed.data
  const gate = await requireAdminToolkitItemEdit(surgeryId, itemId)
  if (!gate.ok) return gate

  const existing = await prisma.adminItem.findFirst({
    where: { id: itemId, surgeryId, deletedAt: null, type: 'PAGE' },
    select: { id: true, title: true, categoryId: true, warningLevel: true, contentHtml: true, lastReviewedAt: true },
  })
  if (!existing) return { ok: false, error: { code: 'NOT_FOUND', message: 'Item not found.' } }

  const cleanedHtml = sanitizeHtml(parsed.data.contentHtml || '')
  const next = {
    title: parsed.data.title,
    categoryId: gate.data.canManage ? (parsed.data.categoryId ?? null) : existing.categoryId,
    contentHtml: cleanedHtml,
    warningLevel: parsed.data.warningLevel ?? null,
    lastReviewedAt: parsed.data.lastReviewedAt ? new Date(parsed.data.lastReviewedAt) : null,
  }

  await prisma.$transaction(async (tx) => {
    await tx.adminItem.update({
      where: { id: itemId },
      data: { ...next, updatedByUserId: gate.data.userId },
    })
    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminItemId: itemId,
        action: 'ITEM_UPDATE',
        actorUserId: gate.data.userId,
        diffJson: {
          before: {
            title: existing.title,
            categoryId: existing.categoryId,
            warningLevel: existing.warningLevel,
            lastReviewedAt: existing.lastReviewedAt,
          },
          after: {
            title: next.title,
            categoryId: next.categoryId,
            warningLevel: next.warningLevel,
            lastReviewedAt: next.lastReviewedAt,
          },
        },
      },
    })
  })

  return { ok: true, data: { id: itemId } }
}

const updateItemInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
  title: z.string().trim().min(1, 'Title is required').max(120, 'Title is too long'),
  categoryId: z.string().min(1).nullable().optional(),
  contentHtml: z.string().optional(), // Legacy field, kept for backwards compatibility
  introHtml: z.string().optional(),
  footerHtml: z.string().optional(),
  warningLevel: z.string().trim().max(40).nullable().optional(),
  lastReviewedAt: z.string().datetime().nullable().optional(),
  roleCardsBlock: z
    .object({
      id: z.string().min(1).optional(),
      title: z.string().trim().max(80).nullable().optional(),
      layout: z.enum(['grid', 'row']).optional(),
      columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
      cards: z
        .array(
          z.object({
            id: z.string().min(1).optional(),
            title: z.string().trim().max(80).default(''),
            body: z.string().max(4000).default(''),
            orderIndex: z.number().int().min(0).optional(),
          }),
        )
        .max(50)
        .default([]),
    })
    .nullable()
    .optional(),
})

export async function updateAdminToolkitItem(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = updateItemInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) } }
  }
  const { surgeryId, itemId } = parsed.data
  const gate = await requireAdminToolkitItemEdit(surgeryId, itemId)
  if (!gate.ok) return gate

  const existing = await prisma.adminItem.findFirst({
    where: { id: itemId, surgeryId, deletedAt: null, type: { in: ['PAGE', 'LIST'] } },
    select: { id: true, type: true, title: true, categoryId: true, warningLevel: true, contentHtml: true, contentJson: true, lastReviewedAt: true },
  })
  if (!existing) return { ok: false, error: { code: 'NOT_FOUND', message: 'Item not found.' } }

  // Keep legacy contentHtml for backwards compatibility (fallback rendering)
  const nextContentHtml = existing.type === 'PAGE' ? sanitizeHtml(parsed.data.contentHtml ?? existing.contentHtml ?? '') : existing.contentHtml

  // Merge blocks for PAGE items
  const mergeBlocks = (
    baseJson: unknown,
    roleCards: (typeof parsed.data)['roleCardsBlock'],
    introHtml: string | undefined,
    footerHtml: string | undefined
  ): unknown => {
    if (existing.type !== 'PAGE') return baseJson
    
    let json = baseJson && typeof baseJson === 'object' && !Array.isArray(baseJson)
      ? ({ ...(baseJson as Record<string, unknown>) } as Record<string, unknown>)
      : ({} as Record<string, unknown>)
    
    // Start with existing blocks (will filter out ones we're updating)
    const blocksRaw = Array.isArray(json.blocks) ? json.blocks : []
    const kept = blocksRaw.filter(
      (b) =>
        !(
          b &&
          typeof b === 'object' &&
          !Array.isArray(b) &&
          ((b as any).type === 'ROLE_CARDS' ||
            (b as any).type === 'INTRO_TEXT' ||
            (b as any).type === 'FOOTER_TEXT')
        )
    )
    
    // Add INTRO_TEXT block if provided
    if (introHtml !== undefined) {
      if (introHtml && !isHtmlEmpty(introHtml)) {
        json = upsertBlock(json, { type: 'INTRO_TEXT', html: sanitizeHtml(introHtml) })
      }
    }
    
    // Add ROLE_CARDS block if provided
    if (roleCards !== undefined) {
      if (roleCards === null) {
        // Remove role cards block
        json = { ...json, blocks: kept.filter((b) => !(b && typeof b === 'object' && !Array.isArray(b) && (b as any).type === 'ROLE_CARDS')) }
      } else {
        json = upsertBlock(json, {
          type: 'ROLE_CARDS' as const,
          id: roleCards.id ?? randomUUID(),
          title: roleCards.title ?? null,
          layout: (roleCards.layout ?? 'grid') as RoleCardsLayout,
          columns: (roleCards.columns ?? 3) as RoleCardsColumns,
          cards: (roleCards.cards ?? [])
            .slice()
            .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
            .map((c, idx) => ({
              id: c.id ?? randomUUID(),
              title: (c.title ?? '').trim(),
              body: c.body ?? '',
              orderIndex: idx,
            })),
        })
      }
    }
    
    // Add FOOTER_TEXT block if provided
    if (footerHtml !== undefined) {
      if (footerHtml && !isHtmlEmpty(footerHtml)) {
        json = upsertBlock(json, { type: 'FOOTER_TEXT', html: sanitizeHtml(footerHtml) })
      }
    }
    
    // If no blocks remain, return null
    const finalBlocks = Array.isArray(json.blocks) ? json.blocks : []
    if (finalBlocks.length === 0) {
      const keys = Object.keys(json).filter((k) => k !== 'blocks')
      return keys.length === 0 ? null : json
    }
    
    return json
  }

  const nextContentJson =
    existing.type === 'PAGE'
      ? mergeBlocks(existing.contentJson, parsed.data.roleCardsBlock, parsed.data.introHtml, parsed.data.footerHtml)
      : existing.contentJson
  const next = {
    title: parsed.data.title,
    categoryId: gate.data.canManage ? (parsed.data.categoryId ?? null) : existing.categoryId,
    warningLevel: parsed.data.warningLevel ?? null,
    lastReviewedAt: parsed.data.lastReviewedAt ? new Date(parsed.data.lastReviewedAt) : null,
    contentHtml: nextContentHtml,
    contentJson: nextContentJson,
  }

  await prisma.$transaction(async (tx) => {
    await tx.adminItem.update({
      where: { id: itemId },
      data: {
        ...next,
        updatedByUserId: gate.data.userId,
        // Ensure contentJson is correctly typed for Prisma
        contentJson: next.contentJson as any, // Ideally use Prisma.InputJsonValue, but fallback to `as any` if type issues persist
      },
    });
    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminItemId: itemId,
        action: 'ITEM_UPDATE',
        actorUserId: gate.data.userId,
        diffJson: {
          before: {
            title: existing.title,
            categoryId: existing.categoryId,
            warningLevel: existing.warningLevel,
            lastReviewedAt: existing.lastReviewedAt,
          },
          after: {
            title: next.title,
            categoryId: next.categoryId,
            warningLevel: next.warningLevel,
            lastReviewedAt: next.lastReviewedAt,
          },
        },
      },
    })
  })

  return { ok: true, data: { id: itemId } }
}

function normaliseListKey(raw: string): string {
  const base = raw
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return base || 'field'
}

const listColumnFieldType = z.enum(['TEXT', 'MULTILINE', 'PHONE', 'EMAIL', 'URL'])

const createListColumnInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
  label: z.string().trim().min(1, 'Label is required').max(80),
  fieldType: listColumnFieldType.default('TEXT'),
})

export async function createAdminToolkitListColumn(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createListColumnInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) } }
  }
  const { surgeryId, itemId, label, fieldType } = parsed.data
  const gate = await requireAdminToolkitItemEdit(surgeryId, itemId)
  if (!gate.ok) return gate

  const existingItem = await prisma.adminItem.findFirst({ where: { id: itemId, surgeryId, deletedAt: null, type: 'LIST' }, select: { id: true } })
  if (!existingItem) return { ok: false, error: { code: 'NOT_FOUND', message: 'List item not found.' } }

  const max = await prisma.adminListColumn.aggregate({ where: { adminItemId: itemId }, _max: { orderIndex: true } })
  const nextOrder = (max._max.orderIndex ?? 0) + 1

  const existingKeys = await prisma.adminListColumn.findMany({ where: { adminItemId: itemId }, select: { key: true } })
  const keySet = new Set(existingKeys.map((k) => k.key))
  const baseKey = normaliseListKey(label)
  let key = baseKey
  let i = 2
  while (keySet.has(key)) {
    key = `${baseKey}_${i}`
    i++
  }

  const created = await prisma.$transaction(async (tx) => {
    const col = await tx.adminListColumn.create({
      data: { adminItemId: itemId, key, label, fieldType, orderIndex: nextOrder },
      select: { id: true },
    })
    await tx.adminItem.update({ where: { id: itemId }, data: { updatedByUserId: gate.data.userId } })
    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminItemId: itemId,
        action: 'LIST_COLUMN_CREATE',
        actorUserId: gate.data.userId,
        diffJson: { key, label, fieldType, orderIndex: nextOrder },
      },
    })
    return col
  })

  return { ok: true, data: { id: created.id } }
}

const updateListColumnInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
  columnId: z.string().min(1),
  label: z.string().trim().min(1, 'Label is required').max(80),
  fieldType: listColumnFieldType,
})

export async function updateAdminToolkitListColumn(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = updateListColumnInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) } }
  }
  const { surgeryId, itemId, columnId, label, fieldType } = parsed.data
  const gate = await requireAdminToolkitItemEdit(surgeryId, itemId)
  if (!gate.ok) return gate

  const existing = await prisma.adminListColumn.findFirst({ where: { id: columnId, adminItemId: itemId }, select: { id: true, label: true, fieldType: true } })
  if (!existing) return { ok: false, error: { code: 'NOT_FOUND', message: 'Column not found.' } }

  await prisma.$transaction(async (tx) => {
    await tx.adminListColumn.update({ where: { id: columnId }, data: { label, fieldType } })
    await tx.adminItem.update({ where: { id: itemId }, data: { updatedByUserId: gate.data.userId } })
    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminItemId: itemId,
        action: 'LIST_COLUMN_UPDATE',
        actorUserId: gate.data.userId,
        diffJson: { before: { label: existing.label, fieldType: existing.fieldType }, after: { label, fieldType } },
      },
    })
  })

  return { ok: true, data: { id: columnId } }
}

const deleteListColumnInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
  columnId: z.string().min(1),
})

export async function deleteAdminToolkitListColumn(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteListColumnInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) } }
  }
  const { surgeryId, itemId, columnId } = parsed.data
  const gate = await requireAdminToolkitItemEdit(surgeryId, itemId)
  if (!gate.ok) return gate

  const existing = await prisma.adminListColumn.findFirst({ where: { id: columnId, adminItemId: itemId }, select: { id: true, key: true, label: true } })
  if (!existing) return { ok: false, error: { code: 'NOT_FOUND', message: 'Column not found.' } }

  await prisma.$transaction(async (tx) => {
    await tx.adminListColumn.delete({ where: { id: columnId } })
    await tx.adminItem.update({ where: { id: itemId }, data: { updatedByUserId: gate.data.userId } })
    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminItemId: itemId,
        action: 'LIST_COLUMN_DELETE',
        actorUserId: gate.data.userId,
        diffJson: { key: existing.key, label: existing.label },
      },
    })
  })

  return { ok: true, data: { id: columnId } }
}

const reorderListColumnsInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
  orderedColumnIds: z.array(z.string().min(1)).min(1),
})

export async function reorderAdminToolkitListColumns(input: unknown): Promise<ActionResult<{ updated: number }>> {
  const parsed = reorderListColumnsInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) } }
  }
  const { surgeryId, itemId, orderedColumnIds } = parsed.data
  const gate = await requireAdminToolkitItemEdit(surgeryId, itemId)
  if (!gate.ok) return gate

  const existing = await prisma.adminListColumn.findMany({ where: { adminItemId: itemId, id: { in: orderedColumnIds } }, select: { id: true } })
  if (existing.length !== orderedColumnIds.length) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'One or more columns were not found.' } }
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedColumnIds.length; i++) {
      await tx.adminListColumn.update({ where: { id: orderedColumnIds[i] }, data: { orderIndex: i } })
    }
    await tx.adminItem.update({ where: { id: itemId }, data: { updatedByUserId: gate.data.userId } })
    await tx.adminHistory.create({
      data: { surgeryId, adminItemId: itemId, action: 'LIST_COLUMN_REORDER', actorUserId: gate.data.userId, diffJson: { orderedColumnIds } },
    })
  })

  return { ok: true, data: { updated: orderedColumnIds.length } }
}

const createListRowInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
})

export async function createAdminToolkitListRow(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createListRowInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) } }
  }
  const { surgeryId, itemId } = parsed.data
  const gate = await requireAdminToolkitItemEdit(surgeryId, itemId)
  if (!gate.ok) return gate

  const existingItem = await prisma.adminItem.findFirst({ where: { id: itemId, surgeryId, deletedAt: null, type: 'LIST' }, select: { id: true } })
  if (!existingItem) return { ok: false, error: { code: 'NOT_FOUND', message: 'List item not found.' } }

  const max = await prisma.adminListRow.aggregate({ where: { adminItemId: itemId, deletedAt: null }, _max: { orderIndex: true } })
  const nextOrder = (max._max.orderIndex ?? 0) + 1

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.adminListRow.create({ data: { adminItemId: itemId, dataJson: {}, orderIndex: nextOrder }, select: { id: true } })
    await tx.adminItem.update({ where: { id: itemId }, data: { updatedByUserId: gate.data.userId } })
    await tx.adminHistory.create({
      data: { surgeryId, adminItemId: itemId, action: 'LIST_ROW_CREATE', actorUserId: gate.data.userId, diffJson: { orderIndex: nextOrder } },
    })
    return row
  })

  return { ok: true, data: { id: created.id } }
}

const updateListRowInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
  rowId: z.string().min(1),
  data: z.record(z.string(), z.string().max(2000)).default({}),
})

export async function updateAdminToolkitListRow(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = updateListRowInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) } }
  }
  const { surgeryId, itemId, rowId, data } = parsed.data
  const gate = await requireAdminToolkitItemEdit(surgeryId, itemId)
  if (!gate.ok) return gate

  const existing = await prisma.adminListRow.findFirst({ where: { id: rowId, adminItemId: itemId, deletedAt: null }, select: { id: true, dataJson: true } })
  if (!existing) return { ok: false, error: { code: 'NOT_FOUND', message: 'Row not found.' } }

  await prisma.$transaction(async (tx) => {
    await tx.adminListRow.update({ where: { id: rowId }, data: { dataJson: data } })
    await tx.adminItem.update({ where: { id: itemId }, data: { updatedByUserId: gate.data.userId } })
    await tx.adminHistory.create({
      data: { surgeryId, adminItemId: itemId, action: 'LIST_ROW_UPDATE', actorUserId: gate.data.userId, diffJson: { before: existing.dataJson, after: data } },
    })
  })

  return { ok: true, data: { id: rowId } }
}

const deleteListRowInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
  rowId: z.string().min(1),
})

export async function deleteAdminToolkitListRow(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteListRowInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) } }
  }
  const { surgeryId, itemId, rowId } = parsed.data
  const gate = await requireAdminToolkitItemEdit(surgeryId, itemId)
  if (!gate.ok) return gate

  const existing = await prisma.adminListRow.findFirst({ where: { id: rowId, adminItemId: itemId, deletedAt: null }, select: { id: true } })
  if (!existing) return { ok: false, error: { code: 'NOT_FOUND', message: 'Row not found.' } }

  await prisma.$transaction(async (tx) => {
    await tx.adminListRow.update({ where: { id: rowId }, data: { deletedAt: new Date() } })
    await tx.adminItem.update({ where: { id: itemId }, data: { updatedByUserId: gate.data.userId } })
    await tx.adminHistory.create({ data: { surgeryId, adminItemId: itemId, action: 'LIST_ROW_DELETE', actorUserId: gate.data.userId } })
  })

  return { ok: true, data: { id: rowId } }
}

const deleteItemInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
})

export async function deleteAdminToolkitItem(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteItemInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) },
    }
  }

  const gate = await requireAdminToolkitWrite(parsed.data.surgeryId)
  if (!gate.ok) return gate

  const { surgeryId, itemId } = parsed.data

  const item = await prisma.adminItem.findFirst({
    where: { id: itemId, surgeryId, deletedAt: null },
    select: { id: true, title: true, type: true },
  })
  if (!item) return { ok: false, error: { code: 'NOT_FOUND', message: 'Item not found.' } }

  await prisma.$transaction(async (tx) => {
    await tx.adminItem.update({ where: { id: itemId }, data: { deletedAt: new Date() } })
    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminItemId: itemId,
        action: 'ITEM_DELETE',
        actorUserId: gate.data.userId,
        diffJson: { title: item.title, type: item.type },
      },
    })
  })

  return { ok: true, data: { id: itemId } }
}

const setEditorsInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
  editorUserIds: z.array(z.string().min(1)),
})

export async function setAdminToolkitItemEditors(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = setEditorsInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) },
    }
  }

  const gate = await requireAdminToolkitWrite(parsed.data.surgeryId)
  if (!gate.ok) return gate

  const { surgeryId, itemId, editorUserIds } = parsed.data

  const existing = await prisma.adminItem.findFirst({
    where: { id: itemId, surgeryId, deletedAt: null },
    select: { id: true, editors: { select: { userId: true } } },
  })
  if (!existing) return { ok: false, error: { code: 'NOT_FOUND', message: 'Item not found.' } }

  const before = existing.editors.map((e) => e.userId).sort()
  const after = Array.from(new Set(editorUserIds)).sort()

  await prisma.$transaction(async (tx) => {
    await tx.adminItemEditor.deleteMany({ where: { adminItemId: itemId } })
    if (after.length > 0) {
      await tx.adminItemEditor.createMany({
        data: after.map((userId) => ({ adminItemId: itemId, userId })),
      })
    }
    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminItemId: itemId,
        action: 'ITEM_EDITORS_SET',
        actorUserId: gate.data.userId,
        diffJson: { before, after },
      },
    })
  })

  return { ok: true, data: { id: itemId } }
}

const setItemEditGrantsInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
  editorUserIds: z.array(z.string().min(1)).default([]),
  allowAllStandardUsers: z.boolean().default(false),
})

export async function setAdminToolkitItemEditGrants(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = setItemEditGrantsInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) },
    }
  }

  const gate = await requireAdminToolkitWrite(parsed.data.surgeryId)
  if (!gate.ok) return gate

  const { surgeryId, itemId } = parsed.data
  const editorUserIds = Array.from(new Set(parsed.data.editorUserIds)).sort()
  const allowAllStandardUsers = parsed.data.allowAllStandardUsers

  const item = await prisma.adminItem.findFirst({
    where: { id: itemId, surgeryId, deletedAt: null },
    select: { id: true },
  })
  if (!item) return { ok: false, error: { code: 'NOT_FOUND', message: 'Item not found.' } }

  // Ensure all selected users are members of this surgery.
  if (editorUserIds.length > 0) {
    const members = await prisma.userSurgery.findMany({
      where: { surgeryId, userId: { in: editorUserIds } },
      select: { userId: true },
    })
    const memberIds = new Set(members.map((m) => m.userId))
    const invalid = editorUserIds.filter((id) => !memberIds.has(id))
    if (invalid.length > 0) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'One or more selected people are not members of this surgery.' } }
    }
  }

  const before = await prisma.adminItemEditGrant.findMany({
    where: { surgeryId, adminItemId: itemId },
    select: { principalType: true, userId: true, role: true },
  })

  await prisma.$transaction(async (tx) => {
    await tx.adminItemEditGrant.deleteMany({ where: { surgeryId, adminItemId: itemId } })

    if (editorUserIds.length > 0) {
      await tx.adminItemEditGrant.createMany({
        data: editorUserIds.map((userId) => ({
          surgeryId,
          adminItemId: itemId,
          principalType: 'USER',
          userId,
          createdByUserId: gate.data.userId,
        })),
      })
    }

    if (allowAllStandardUsers) {
      await tx.adminItemEditGrant.create({
        data: {
          surgeryId,
          adminItemId: itemId,
          principalType: 'ROLE',
          role: 'STANDARD',
          createdByUserId: gate.data.userId,
        },
        select: { id: true },
      })
    }

    const after = await tx.adminItemEditGrant.findMany({
      where: { surgeryId, adminItemId: itemId },
      select: { principalType: true, userId: true, role: true },
    })

    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminItemId: itemId,
        action: 'ITEM_EDIT_GRANTS_SET',
        actorUserId: gate.data.userId,
        diffJson: { before, after },
      },
    })
  })

  return { ok: true, data: { id: itemId } }
}

const upsertPinnedPanelInput = z.object({
  surgeryId: z.string().min(1),
  taskBuddyText: z.string().max(2000).nullable().optional(),
  postRouteText: z.string().max(2000).nullable().optional(),
})

export async function upsertAdminToolkitPinnedPanel(input: unknown): Promise<ActionResult<{ surgeryId: string }>> {
  const parsed = upsertPinnedPanelInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) },
    }
  }

  const gate = await requireAdminToolkitWrite(parsed.data.surgeryId)
  if (!gate.ok) return gate

  const { surgeryId, taskBuddyText, postRouteText } = parsed.data

  await prisma.$transaction(async (tx) => {
    await tx.adminPinnedPanel.upsert({
      where: { surgeryId },
      update: { taskBuddyText: taskBuddyText ?? null, postRouteText: postRouteText ?? null },
      create: { surgeryId, taskBuddyText: taskBuddyText ?? null, postRouteText: postRouteText ?? null },
    })
    await tx.adminHistory.create({
      data: {
        surgeryId,
        action: 'PINNED_PANEL_UPDATE',
        actorUserId: gate.data.userId,
        diffJson: { taskBuddyText: taskBuddyText ?? null, postRouteText: postRouteText ?? null },
      },
    })
  })

  return { ok: true, data: { surgeryId } }
}

const hexColour = z.string().regex(/^#([0-9a-fA-F]{6})$/, 'Use a hex colour like #005EB8')

const quickAccessButtonInput = z.object({
  id: z.string().min(1).optional(),
  label: z.string().max(40, 'Button label is too long').optional(),
  itemId: z.string().min(1, 'Pick a target item'),
  backgroundColour: hexColour,
  textColour: hexColour,
})

const setQuickAccessButtonsInput = z.object({
  surgeryId: z.string().min(1),
  buttons: z.array(quickAccessButtonInput).max(24, 'Too many buttons'),
})

export async function setAdminToolkitQuickAccessButtons(
  input: unknown,
): Promise<ActionResult<{ buttons: AdminToolkitQuickAccessButton[] }>> {
  const parsed = setQuickAccessButtonsInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) },
    }
  }

  const gate = await requireAdminToolkitWrite(parsed.data.surgeryId)
  if (!gate.ok) return gate

  const { surgeryId } = parsed.data

  // Validate item targets exist within the surgery (and use titles for default labels).
  const itemIds = Array.from(new Set(parsed.data.buttons.map((b) => b.itemId)))
  const items = await prisma.adminItem.findMany({
    where: { surgeryId, deletedAt: null, type: { in: ['PAGE', 'LIST'] }, id: { in: itemIds } },
    select: { id: true, title: true },
  })
  const itemById = new Map(items.map((x) => [x.id, x]))
  const bad = itemIds.find((id) => !itemById.has(id))
  if (bad) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'One or more target items could not be found.' } }
  }

  // Normalise IDs and order, defaulting blank labels to the target item title (stable).
  const normalised: AdminToolkitQuickAccessButton[] = []
  for (const [idx, b] of parsed.data.buttons.entries()) {
    const fallback = (itemById.get(b.itemId)?.title ?? '').trim()
    const rawLabel = (b.label ?? '').trim()
    const resolved = (rawLabel || fallback).slice(0, 40)
    if (!resolved) {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Button label is required.', fieldErrors: { label: 'Button label is required.' } } }
    }
    normalised.push({
      id: b.id ?? randomUUID(),
      label: resolved,
      itemId: b.itemId,
      backgroundColour: b.backgroundColour.toUpperCase(),
      textColour: b.textColour.toUpperCase(),
      orderIndex: idx,
    })
  }

  await prisma.$transaction(async (tx) => {
    const row = await tx.surgery.findUnique({ where: { id: surgeryId }, select: { uiConfig: true } })
    const existing = row?.uiConfig
    const base =
      existing && typeof existing === 'object' && !Array.isArray(existing) ? (existing as Record<string, unknown>) : ({} as Record<string, unknown>)
    const existingAdminToolkit =
      base.adminToolkit && typeof base.adminToolkit === 'object' && !Array.isArray(base.adminToolkit)
        ? (base.adminToolkit as Record<string, unknown>)
        : ({} as Record<string, unknown>)

    const nextUiConfig: AdminToolkitUiConfig & Record<string, unknown> = {
      ...base,
      adminToolkit: {
        ...existingAdminToolkit,
        quickAccessButtons: normalised,
      },
    }

    await tx.surgery.update({
      where: { id: surgeryId },
      data: { uiConfig: nextUiConfig as any },
    })

    await tx.adminHistory.create({
      data: {
        surgeryId,
        action: 'QUICK_ACCESS_SET',
        actorUserId: gate.data.userId,
        diffJson: { buttons: normalised },
      },
    })
  })

  return { ok: true, data: { buttons: normalised } }
}

const setOnTakeWeekInput = z.object({
  surgeryId: z.string().min(1),
  weekCommencingIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  gpName: z.string().trim().max(120).nullable(),
})

export async function setAdminToolkitOnTakeWeek(input: unknown): Promise<ActionResult<{ surgeryId: string }>> {
  const parsed = setOnTakeWeekInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) },
    }
  }

  const gate = await requireAdminToolkitWrite(parsed.data.surgeryId)
  if (!gate.ok) return gate

  const { surgeryId, weekCommencingIso, gpName } = parsed.data
  const weekCommencingUtc = new Date(`${weekCommencingIso}T00:00:00.000Z`)
  const name = (gpName || '').trim()

  await prisma.$transaction(async (tx) => {
    if (!name) {
      await tx.adminOnTakeWeek.deleteMany({ where: { surgeryId, weekCommencing: weekCommencingUtc } })
    } else {
      await tx.adminOnTakeWeek.upsert({
        where: { surgeryId_weekCommencing: { surgeryId, weekCommencing: weekCommencingUtc } },
        update: { gpName: name },
        create: { surgeryId, weekCommencing: weekCommencingUtc, gpName: name },
      })
    }

    await tx.adminHistory.create({
      data: {
        surgeryId,
        action: 'ON_TAKE_WEEK_SET',
        actorUserId: gate.data.userId,
        diffJson: { weekCommencing: weekCommencingIso, gpName: name || null },
      },
    })
  })

  return { ok: true, data: { surgeryId } }
}

const getOnTakeWeekInput = z.object({
  surgeryId: z.string().min(1),
  weekCommencingIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
})

export async function getAdminToolkitOnTakeWeekValue(input: unknown): Promise<ActionResult<{ gpName: string | null }>> {
  const parsed = getOnTakeWeekInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) },
    }
  }

  const gate = await requireAdminToolkitView(parsed.data.surgeryId)
  if (!gate.ok) return gate

  const { surgeryId, weekCommencingIso } = parsed.data
  const weekCommencingUtc = new Date(`${weekCommencingIso}T00:00:00.000Z`)

  const row = await prisma.adminOnTakeWeek.findUnique({
    where: { surgeryId_weekCommencing: { surgeryId, weekCommencing: weekCommencingUtc } },
    select: { gpName: true },
  })

  return { ok: true, data: { gpName: row?.gpName ?? null } }
}

const addAttachmentInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
  label: z.string().trim().min(1, 'Label is required').max(120),
  url: z.string().url('Enter a valid URL'),
})

export async function addAdminToolkitAttachmentLink(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = addAttachmentInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) },
    }
  }
  const { surgeryId, itemId, label, url } = parsed.data
  const gate = await requireAdminToolkitItemEdit(surgeryId, itemId)
  if (!gate.ok) return gate

  const max = await prisma.adminItemAttachment.aggregate({
    where: { surgeryId, adminItemId: itemId, deletedAt: null },
    _max: { orderIndex: true },
  })
  const nextOrder = (max._max.orderIndex ?? 0) + 1

  const created = await prisma.$transaction(async (tx) => {
    const attachment = await tx.adminItemAttachment.create({
      data: { surgeryId, adminItemId: itemId, label, url, orderIndex: nextOrder },
      select: { id: true },
    })
    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminItemId: itemId,
        action: 'ATTACHMENT_ADD',
        actorUserId: gate.data.userId,
        diffJson: { label, url },
      },
    })
    return attachment
  })

  return { ok: true, data: { id: created.id } }
}

const removeAttachmentInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
  attachmentId: z.string().min(1),
})

export async function removeAdminToolkitAttachment(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = removeAttachmentInput.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) },
    }
  }
  const { surgeryId, itemId, attachmentId } = parsed.data
  const gate = await requireAdminToolkitItemEdit(surgeryId, itemId)
  if (!gate.ok) return gate

  const existing = await prisma.adminItemAttachment.findFirst({
    where: { id: attachmentId, surgeryId, adminItemId: itemId, deletedAt: null },
    select: { id: true, label: true, url: true },
  })
  if (!existing) return { ok: false, error: { code: 'NOT_FOUND', message: 'Attachment not found.' } }

  await prisma.$transaction(async (tx) => {
    await tx.adminItemAttachment.update({ where: { id: attachmentId }, data: { deletedAt: new Date() } })
    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminItemId: itemId,
        action: 'ATTACHMENT_REMOVE',
        actorUserId: gate.data.userId,
        diffJson: { label: existing.label, url: existing.url },
      },
    })
  })

  return { ok: true, data: { id: attachmentId } }
}

