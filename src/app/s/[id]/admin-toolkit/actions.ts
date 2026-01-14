'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess, requireSuperuser, can } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { sanitizeHtml } from '@/lib/sanitizeHtml'

type ActionError =
  | { code: 'UNAUTHENTICATED'; message: string }
  | { code: 'FORBIDDEN'; message: string }
  | { code: 'FEATURE_DISABLED'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string; fieldErrors?: Record<string, string> }
  | { code: 'CATEGORY_NOT_EMPTY'; message: string }
  | { code: 'CONFLICT'; message: string }
  | { code: 'PRECONDITION_FAILED'; message: string }
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

type ResolvedSurgery = { id: string; name: string; slug: string | null }

async function resolveSurgeryBySlugOrId(slugOrId: string): Promise<ResolvedSurgery | null> {
  const value = slugOrId.trim()
  if (!value) return null
  return prisma.surgery.findFirst({
    where: { OR: [{ id: value }, { slug: value }] },
    select: { id: true, name: true, slug: true },
  })
}

type ToolkitCounts = {
  categories: number
  items: number
  attachments: number
  rotaWeeks: number
}

type ToolkitEditorLinkCounts = {
  copied: number
  skipped: number
}

function sumAttachments(items: Array<{ attachments: Array<unknown> }>): number {
  return items.reduce((acc, it) => acc + it.attachments.length, 0)
}

const copyThenClearInput = z.object({
  sourceSurgerySlugOrId: z.string().min(1),
  targetSurgerySlugOrId: z.string().min(1),
  dryRun: z.boolean().optional().default(false),
})

type CopyThenClearDryRun = {
  dryRun: true
  source: ResolvedSurgery
  target: ResolvedSurgery
  sourceActiveCounts: ToolkitCounts
  targetActiveCounts: ToolkitCounts
  editorLinks: ToolkitEditorLinkCounts
  canProceed: boolean
  blockingReasons: string[]
}

type CopyThenClearResult = {
  dryRun: false
  source: ResolvedSurgery
  target: ResolvedSurgery
  copied: ToolkitCounts
  editorLinks: ToolkitEditorLinkCounts
  clearedSource: {
    itemsSoftDeleted: number
    categoriesSoftDeleted: number
    attachmentsSoftDeleted: number
    editorLinksDeleted: number
    rotaWeeksDeleted: number
    pinnedPanelCleared: boolean
    legacyDailyRotaDeleted: number
  }
}

export async function copyAdminToolkitThenClear(input: unknown): Promise<ActionResult<CopyThenClearDryRun | CopyThenClearResult>> {
  const parsed = copyThenClearInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) } }
  }

  let actor
  try {
    actor = await requireSuperuser()
  } catch {
    return { ok: false, error: { code: 'FORBIDDEN', message: 'Superuser access required.' } }
  }

  const { sourceSurgerySlugOrId, targetSurgerySlugOrId, dryRun } = parsed.data
  const [source, target] = await Promise.all([
    resolveSurgeryBySlugOrId(sourceSurgerySlugOrId),
    resolveSurgeryBySlugOrId(targetSurgerySlugOrId),
  ])

  if (!source) return { ok: false, error: { code: 'NOT_FOUND', message: 'Source surgery not found.' } }
  if (!target) return { ok: false, error: { code: 'NOT_FOUND', message: 'Target surgery not found.' } }
  if (source.id === target.id) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Source and target surgeries must be different.' } }
  }

  // Snapshot counts (active-only) and preconditions
  const [sourceCats, sourceItems, sourceWeeks, targetCatsCount, targetItemsCount, targetWeeksCount, targetUserIds] =
    await Promise.all([
      prisma.adminCategory.findMany({
        where: { surgeryId: source.id, deletedAt: null },
        select: { id: true, name: true, orderIndex: true },
        orderBy: [{ orderIndex: 'asc' }],
      }),
      prisma.adminItem.findMany({
        where: { surgeryId: source.id, deletedAt: null, type: 'PAGE' },
        select: {
          id: true,
          categoryId: true,
          title: true,
          contentHtml: true,
          warningLevel: true,
          lastReviewedAt: true,
          attachments: { where: { deletedAt: null }, select: { id: true, label: true, url: true, orderIndex: true }, orderBy: [{ orderIndex: 'asc' }] },
          editors: { select: { userId: true } },
        },
        orderBy: [{ title: 'asc' }],
      }),
      prisma.adminOnTakeWeek.findMany({ where: { surgeryId: source.id }, select: { weekCommencing: true, gpName: true }, orderBy: [{ weekCommencing: 'asc' }] }),
      prisma.adminCategory.count({ where: { surgeryId: target.id, deletedAt: null } }),
      prisma.adminItem.count({ where: { surgeryId: target.id, deletedAt: null, type: 'PAGE' } }),
      prisma.adminOnTakeWeek.count({ where: { surgeryId: target.id } }),
      prisma.userSurgery.findMany({ where: { surgeryId: target.id }, select: { userId: true } }),
    ])

  const targetMembers = new Set(targetUserIds.map((m) => m.userId))
  const editorLinks: ToolkitEditorLinkCounts = sourceItems.reduce(
    (acc, it) => {
      for (const e of it.editors) {
        if (targetMembers.has(e.userId)) acc.copied++
        else acc.skipped++
      }
      return acc
    },
    { copied: 0, skipped: 0 } as ToolkitEditorLinkCounts,
  )

  const sourceActiveCounts: ToolkitCounts = {
    categories: sourceCats.length,
    items: sourceItems.length,
    attachments: sumAttachments(sourceItems),
    rotaWeeks: sourceWeeks.length,
  }

  const targetActiveCounts: ToolkitCounts = {
    categories: targetCatsCount,
    items: targetItemsCount,
    attachments: await prisma.adminItemAttachment.count({ where: { surgeryId: target.id, deletedAt: null } }),
    rotaWeeks: targetWeeksCount,
  }

  const blockingReasons: string[] = []
  const sourceIsEmpty =
    sourceActiveCounts.categories === 0 &&
    sourceActiveCounts.items === 0 &&
    sourceActiveCounts.attachments === 0 &&
    sourceActiveCounts.rotaWeeks === 0

  // Idempotency: if the source is already empty (previously cleared), treat this as a safe no-op even if the target now has content.
  if (!sourceIsEmpty && (targetActiveCounts.categories > 0 || targetActiveCounts.items > 0 || targetActiveCounts.attachments > 0 || targetActiveCounts.rotaWeeks > 0)) {
    blockingReasons.push('Target surgery already has Admin Toolkit content. This tool only runs into an empty target.')
  }

  if (dryRun) {
    return {
      ok: true,
      data: {
        dryRun: true,
        source,
        target,
        sourceActiveCounts,
        targetActiveCounts,
        editorLinks,
        canProceed: blockingReasons.length === 0,
        blockingReasons,
      },
    }
  }

  if (blockingReasons.length > 0) {
    return { ok: false, error: { code: 'CONFLICT', message: blockingReasons.join(' ') } }
  }

  if (sourceIsEmpty) {
    return {
      ok: true,
      data: {
        dryRun: false,
        source,
        target,
        copied: { categories: 0, items: 0, attachments: 0, rotaWeeks: 0 },
        editorLinks: { copied: 0, skipped: 0 },
        clearedSource: {
          itemsSoftDeleted: 0,
          categoriesSoftDeleted: 0,
          attachmentsSoftDeleted: 0,
          editorLinksDeleted: 0,
          rotaWeeksDeleted: 0,
          pinnedPanelCleared: true,
          legacyDailyRotaDeleted: 0,
        },
      },
    }
  }

  // Copy phase (single transaction). If anything doesn't match, throw to rollback.
  const copied = await prisma.$transaction(async (tx) => {
    const [panel, sourceDailyRota] = await Promise.all([
      tx.adminPinnedPanel.findUnique({ where: { surgeryId: source.id }, select: { taskBuddyText: true, postRouteText: true } }),
      tx.adminDutyRotaEntry.count({ where: { surgeryId: source.id } }),
    ])

    const categoryMap = new Map<string, string>()
    for (const cat of sourceCats) {
      const created = await tx.adminCategory.create({
        data: { surgeryId: target.id, name: cat.name, orderIndex: cat.orderIndex },
        select: { id: true },
      })
      categoryMap.set(cat.id, created.id)
    }

    // Pinned panel: copy values (null-safe) into target.
    await tx.adminPinnedPanel.upsert({
      where: { surgeryId: target.id },
      update: { taskBuddyText: panel?.taskBuddyText ?? null, postRouteText: panel?.postRouteText ?? null },
      create: { surgeryId: target.id, taskBuddyText: panel?.taskBuddyText ?? null, postRouteText: panel?.postRouteText ?? null },
    })

    // Rota: copy all weekly records.
    if (sourceWeeks.length > 0) {
      await tx.adminOnTakeWeek.createMany({
        data: sourceWeeks.map((w) => ({ surgeryId: target.id, weekCommencing: w.weekCommencing, gpName: w.gpName })),
      })
    }

    let attachmentsCopied = 0
    let editorCopied = 0
    let editorSkipped = 0
    let itemsCopied = 0

    for (const it of sourceItems) {
      const createdItem = await tx.adminItem.create({
        data: {
          surgeryId: target.id,
          categoryId: it.categoryId ? categoryMap.get(it.categoryId) ?? null : null,
          type: 'PAGE',
          title: it.title,
          contentHtml: it.contentHtml ?? '',
          warningLevel: it.warningLevel ?? null,
          lastReviewedAt: it.lastReviewedAt,
          ownerUserId: actor.id,
        },
        select: { id: true },
      })
      itemsCopied++

      if (it.attachments.length > 0) {
        await tx.adminItemAttachment.createMany({
          data: it.attachments.map((a) => ({
            surgeryId: target.id,
            adminItemId: createdItem.id,
            label: a.label,
            url: a.url,
            orderIndex: a.orderIndex,
          })),
        })
        attachmentsCopied += it.attachments.length
      }

      if (it.editors.length > 0) {
        const allowed = it.editors.filter((e) => targetMembers.has(e.userId)).map((e) => e.userId)
        editorCopied += allowed.length
        editorSkipped += it.editors.length - allowed.length
        if (allowed.length > 0) {
          await tx.adminItemEditor.createMany({
            data: allowed.map((userId) => ({ adminItemId: createdItem.id, userId })),
            skipDuplicates: true,
          })
        }
      }
    }

    const copiedCounts: ToolkitCounts = {
      categories: sourceCats.length,
      items: itemsCopied,
      attachments: attachmentsCopied,
      rotaWeeks: sourceWeeks.length,
    }

    // Verification before clearing: compare copied vs source snapshot counts.
    if (
      copiedCounts.categories !== sourceActiveCounts.categories ||
      copiedCounts.items !== sourceActiveCounts.items ||
      copiedCounts.attachments !== sourceActiveCounts.attachments ||
      copiedCounts.rotaWeeks !== sourceActiveCounts.rotaWeeks
    ) {
      throw new Error('ADMIN_TOOLKIT_COPY_COUNT_MISMATCH')
    }

    await tx.adminHistory.create({
      data: {
        surgeryId: target.id,
        action: 'TOOLKIT_COPY_IN',
        actorUserId: actor.id,
        diffJson: { fromSurgeryId: source.id, copied: copiedCounts, editorLinks: { copied: editorCopied, skipped: editorSkipped }, legacyDailyRotaInSource: sourceDailyRota },
      },
    })

    return { copiedCounts, editorCopied, editorSkipped }
  })

  // Clear phase (second transaction) – source surgery only.
  const clearedSource = await prisma.$transaction(async (tx) => {
    const now = new Date()

    const [itemsRes, catsRes, attsRes, editorRes, rotaRes, legacyDailyRes] = await Promise.all([
      tx.adminItem.updateMany({ where: { surgeryId: source.id, deletedAt: null }, data: { deletedAt: now } }),
      tx.adminCategory.updateMany({ where: { surgeryId: source.id, deletedAt: null }, data: { deletedAt: now } }),
      tx.adminItemAttachment.updateMany({ where: { surgeryId: source.id, deletedAt: null }, data: { deletedAt: now } }),
      tx.adminItemEditor.deleteMany({ where: { adminItem: { surgeryId: source.id } } }),
      tx.adminOnTakeWeek.deleteMany({ where: { surgeryId: source.id } }),
      tx.adminDutyRotaEntry.deleteMany({ where: { surgeryId: source.id } }),
    ])

    await tx.adminPinnedPanel.upsert({
      where: { surgeryId: source.id },
      update: { taskBuddyText: '', postRouteText: '' },
      create: { surgeryId: source.id, taskBuddyText: '', postRouteText: '' },
    })

    await tx.adminHistory.create({
      data: {
        surgeryId: source.id,
        action: 'TOOLKIT_CLEARED',
        actorUserId: actor.id,
        diffJson: {
          clearedAt: now.toISOString(),
          itemsSoftDeleted: itemsRes.count,
          categoriesSoftDeleted: catsRes.count,
          attachmentsSoftDeleted: attsRes.count,
          editorLinksDeleted: editorRes.count,
          rotaWeeksDeleted: rotaRes.count,
          legacyDailyRotaDeleted: legacyDailyRes.count,
        },
      },
    })

    return {
      itemsSoftDeleted: itemsRes.count,
      categoriesSoftDeleted: catsRes.count,
      attachmentsSoftDeleted: attsRes.count,
      editorLinksDeleted: editorRes.count,
      rotaWeeksDeleted: rotaRes.count,
      pinnedPanelCleared: true,
      legacyDailyRotaDeleted: legacyDailyRes.count,
    }
  })

  return {
    ok: true,
    data: {
      dryRun: false,
      source,
      target,
      copied: copied.copiedCounts,
      editorLinks: { copied: copied.editorCopied, skipped: copied.editorSkipped },
      clearedSource,
    },
  }
}

const clearToolkitInput = z.object({
  surgerySlugOrId: z.string().min(1),
  dryRun: z.boolean().optional().default(false),
})

type ClearToolkitDryRun = {
  dryRun: true
  surgery: ResolvedSurgery
  activeCounts: ToolkitCounts
}

type ClearToolkitResult = {
  dryRun: false
  surgery: ResolvedSurgery
  cleared: {
    itemsSoftDeleted: number
    categoriesSoftDeleted: number
    attachmentsSoftDeleted: number
    editorLinksDeleted: number
    rotaWeeksDeleted: number
    pinnedPanelCleared: boolean
    legacyDailyRotaDeleted: number
  }
}

export async function clearAdminToolkitContent(input: unknown): Promise<ActionResult<ClearToolkitDryRun | ClearToolkitResult>> {
  const parsed = clearToolkitInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.', fieldErrors: zodFieldErrors(parsed.error) } }
  }

  let actor
  try {
    actor = await requireSuperuser()
  } catch {
    return { ok: false, error: { code: 'FORBIDDEN', message: 'Superuser access required.' } }
  }

  const surgery = await resolveSurgeryBySlugOrId(parsed.data.surgerySlugOrId)
  if (!surgery) return { ok: false, error: { code: 'NOT_FOUND', message: 'Surgery not found.' } }

  const [catsCount, itemsCount, attsCount, weeksCount] = await Promise.all([
    prisma.adminCategory.count({ where: { surgeryId: surgery.id, deletedAt: null } }),
    prisma.adminItem.count({ where: { surgeryId: surgery.id, deletedAt: null } }),
    prisma.adminItemAttachment.count({ where: { surgeryId: surgery.id, deletedAt: null } }),
    prisma.adminOnTakeWeek.count({ where: { surgeryId: surgery.id } }),
  ])

  const activeCounts: ToolkitCounts = { categories: catsCount, items: itemsCount, attachments: attsCount, rotaWeeks: weeksCount }

  if (parsed.data.dryRun) {
    return { ok: true, data: { dryRun: true, surgery, activeCounts } }
  }

  const cleared = await prisma.$transaction(async (tx) => {
    const now = new Date()
    const [itemsRes, catsRes, attsRes, editorRes, rotaRes, legacyDailyRes] = await Promise.all([
      tx.adminItem.updateMany({ where: { surgeryId: surgery.id, deletedAt: null }, data: { deletedAt: now } }),
      tx.adminCategory.updateMany({ where: { surgeryId: surgery.id, deletedAt: null }, data: { deletedAt: now } }),
      tx.adminItemAttachment.updateMany({ where: { surgeryId: surgery.id, deletedAt: null }, data: { deletedAt: now } }),
      tx.adminItemEditor.deleteMany({ where: { adminItem: { surgeryId: surgery.id } } }),
      tx.adminOnTakeWeek.deleteMany({ where: { surgeryId: surgery.id } }),
      tx.adminDutyRotaEntry.deleteMany({ where: { surgeryId: surgery.id } }),
    ])

    await tx.adminPinnedPanel.upsert({
      where: { surgeryId: surgery.id },
      update: { taskBuddyText: '', postRouteText: '' },
      create: { surgeryId: surgery.id, taskBuddyText: '', postRouteText: '' },
    })

    await tx.adminHistory.create({
      data: {
        surgeryId: surgery.id,
        action: 'TOOLKIT_CLEARED',
        actorUserId: actor.id,
        diffJson: {
          clearedAt: now.toISOString(),
          itemsSoftDeleted: itemsRes.count,
          categoriesSoftDeleted: catsRes.count,
          attachmentsSoftDeleted: attsRes.count,
          editorLinksDeleted: editorRes.count,
          rotaWeeksDeleted: rotaRes.count,
          legacyDailyRotaDeleted: legacyDailyRes.count,
        },
      },
    })

    return {
      itemsSoftDeleted: itemsRes.count,
      categoriesSoftDeleted: catsRes.count,
      attachmentsSoftDeleted: attsRes.count,
      editorLinksDeleted: editorRes.count,
      rotaWeeksDeleted: rotaRes.count,
      pinnedPanelCleared: true,
      legacyDailyRotaDeleted: legacyDailyRes.count,
    }
  })

  return { ok: true, data: { dryRun: false, surgery, cleared } }
}

