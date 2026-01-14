'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess, can } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { sanitizeHtml } from '@/lib/sanitizeHtml'

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
      return { ok: false, error: { code: 'FEATURE_DISABLED', message: 'Admin Toolkit is not enabled for this surgery.' } }
    }
    if (!can(user).adminToolkitWrite(surgeryId)) {
      return { ok: false, error: { code: 'FORBIDDEN', message: 'You do not have write access for Admin Toolkit.' } }
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
      return { ok: false, error: { code: 'FEATURE_DISABLED', message: 'Admin Toolkit is not enabled for this surgery.' } }
    }
    return { ok: true, data: { surgeryId } }
  } catch {
    return { ok: false, error: { code: 'UNAUTHENTICATED', message: 'You must be signed in.' } }
  }
}

async function canEditItem(opts: { surgeryId: string; itemId: string; userId: string; isSuperuser: boolean }): Promise<boolean> {
  if (opts.isSuperuser) return true

  const item = await prisma.adminItem.findFirst({
    where: { id: opts.itemId, surgeryId: opts.surgeryId, deletedAt: null },
    select: {
      id: true,
      editors: { select: { userId: true } },
    },
  })
  if (!item) return false
  const hasRestrictions = item.editors.length > 0
  if (!hasRestrictions) return true
  return item.editors.some((e) => e.userId === opts.userId)
}

const createCategoryInput = z.object({
  surgeryId: z.string().min(1),
  name: z.string().trim().min(1, 'Category name is required').max(80, 'Category name is too long'),
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

  const { surgeryId, name } = parsed.data
  const max = await prisma.adminCategory.aggregate({
    where: { surgeryId, deletedAt: null },
    _max: { orderIndex: true },
  })
  const nextOrder = (max._max.orderIndex ?? 0) + 1

  const created = await prisma.$transaction(async (tx) => {
    const category = await tx.adminCategory.create({
      data: { surgeryId, name, orderIndex: nextOrder },
      select: { id: true },
    })
    await tx.adminHistory.create({
      data: {
        surgeryId,
        adminCategoryId: category.id,
        action: 'CATEGORY_CREATE',
        actorUserId: gate.data.userId,
        diffJson: { name },
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
    select: { id: true, name: true },
  })
  if (!category) return { ok: false, error: { code: 'NOT_FOUND', message: 'Category not found.' } }

  const itemsCount = await prisma.adminItem.count({
    where: { surgeryId, categoryId, deletedAt: null },
  })
  if (itemsCount > 0) {
    return { ok: false, error: { code: 'CATEGORY_NOT_EMPTY', message: 'You cannot delete a category that still contains items.' } }
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

  const gate = await requireAdminToolkitWrite(parsed.data.surgeryId)
  if (!gate.ok) return gate

  const { surgeryId, itemId } = parsed.data
  const allowed = await canEditItem({ surgeryId, itemId, userId: gate.data.userId, isSuperuser: gate.data.isSuperuser })
  if (!allowed) {
    return { ok: false, error: { code: 'FORBIDDEN', message: 'This item is restricted to a smaller set of editors.' } }
  }

  const existing = await prisma.adminItem.findFirst({
    where: { id: itemId, surgeryId, deletedAt: null, type: 'PAGE' },
    select: { id: true, title: true, categoryId: true, warningLevel: true, contentHtml: true, lastReviewedAt: true },
  })
  if (!existing) return { ok: false, error: { code: 'NOT_FOUND', message: 'Item not found.' } }

  const cleanedHtml = sanitizeHtml(parsed.data.contentHtml || '')
  const next = {
    title: parsed.data.title,
    categoryId: parsed.data.categoryId ?? null,
    contentHtml: cleanedHtml,
    warningLevel: parsed.data.warningLevel ?? null,
    lastReviewedAt: parsed.data.lastReviewedAt ? new Date(parsed.data.lastReviewedAt) : null,
  }

  await prisma.$transaction(async (tx) => {
    await tx.adminItem.update({
      where: { id: itemId },
      data: next,
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
  const allowed = await canEditItem({ surgeryId, itemId, userId: gate.data.userId, isSuperuser: gate.data.isSuperuser })
  if (!allowed) {
    return { ok: false, error: { code: 'FORBIDDEN', message: 'This item is restricted to a smaller set of editors.' } }
  }

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

  // Restriction management is itself restricted if the item is already restricted.
  const allowed = await canEditItem({ surgeryId, itemId, userId: gate.data.userId, isSuperuser: gate.data.isSuperuser })
  if (!allowed) {
    return { ok: false, error: { code: 'FORBIDDEN', message: 'This item is restricted to a smaller set of editors.' } }
  }

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

  const gate = await requireAdminToolkitWrite(parsed.data.surgeryId)
  if (!gate.ok) return gate

  const { surgeryId, itemId, label, url } = parsed.data
  const allowed = await canEditItem({ surgeryId, itemId, userId: gate.data.userId, isSuperuser: gate.data.isSuperuser })
  if (!allowed) {
    return { ok: false, error: { code: 'FORBIDDEN', message: 'This item is restricted to a smaller set of editors.' } }
  }

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

  const gate = await requireAdminToolkitWrite(parsed.data.surgeryId)
  if (!gate.ok) return gate

  const { surgeryId, itemId, attachmentId } = parsed.data
  const allowed = await canEditItem({ surgeryId, itemId, userId: gate.data.userId, isSuperuser: gate.data.isSuperuser })
  if (!allowed) {
    return { ok: false, error: { code: 'FORBIDDEN', message: 'This item is restricted to a smaller set of editors.' } }
  }

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

