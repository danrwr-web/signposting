import 'server-only'

import { prisma } from '@/lib/prisma'
import type { AdminToolkitQuickAccessButton, AdminToolkitUiConfig } from '@/lib/adminToolkitQuickAccessShared'
import { z } from 'zod'

export type AdminToolkitCategory = {
  id: string
  name: string
  orderIndex: number
  parentCategoryId: string | null
  children?: AdminToolkitCategory[]
}

export type AdminToolkitPageItem = {
  id: string
  type: 'PAGE' | 'LIST'
  title: string
  categoryId: string | null
  warningLevel: string | null
  contentHtml: string | null
  contentJson?: unknown | null
  lastReviewedAt: Date | null
  updatedAt: Date
  createdAt: Date
  ownerUserId: string | null
  createdBy?: { id: string; name: string | null; email: string } | null
  updatedBy?: { id: string; name: string | null; email: string } | null
  editors: Array<{ userId: string }>
  attachments: Array<{ id: string; label: string; url: string; orderIndex: number; deletedAt: Date | null }>
  listColumns?: Array<{ id: string; key: string; label: string; fieldType: string; orderIndex: number }>
  listRows?: Array<{ id: string; dataJson: unknown; orderIndex: number }>
}

export type AdminToolkitPinnedPanel = {
  taskBuddyText: string | null
  postRouteText: string | null
  updatedAt: Date
}

export type AdminToolkitOnTakeWeek = {
  weekCommencing: Date
  gpName: string
}

const adminToolkitQuickAccessButtonSchema = z.object({
  id: z.string().min(1),
  label: z
    .string()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => (v ?? '').trim()),
  itemId: z.string().min(1),
  backgroundColour: z.string().regex(/^#([0-9a-fA-F]{6})$/),
  textColour: z.string().regex(/^#([0-9a-fA-F]{6})$/),
  orderIndex: z.number().int().min(0),
})

const adminToolkitUiConfigSchema = z
  .object({
    adminToolkit: z
      .object({
        quickAccessButtons: z.array(adminToolkitQuickAccessButtonSchema).optional(),
      })
      .optional(),
  })
  .passthrough()

export function readAdminToolkitQuickAccessButtons(uiConfig: unknown): AdminToolkitQuickAccessButton[] {
  const parsed = adminToolkitUiConfigSchema.safeParse(uiConfig)
  const raw = parsed.success ? parsed.data.adminToolkit?.quickAccessButtons : undefined
  const list = (raw ?? []).slice()
  list.sort((a, b) => a.orderIndex - b.orderIndex)
  return list
}

export async function getAdminToolkitQuickAccessButtons(surgeryId: string): Promise<AdminToolkitQuickAccessButton[]> {
  const row = await prisma.surgery.findUnique({
    where: { id: surgeryId },
    select: { uiConfig: true },
  })
  return readAdminToolkitQuickAccessButtons(row?.uiConfig ?? null)
}

export function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function startOfWeekMondayUtc(date: Date): Date {
  const day = date.getUTCDay() // 0=Sun ... 6=Sat
  const delta = (day + 6) % 7 // Monday -> 0
  const d = startOfDayUtc(date)
  d.setUTCDate(d.getUTCDate() - delta)
  return d
}

export function addDaysUtc(date: Date, days: number): Date {
  const d = new Date(date.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

export function getLondonTodayUtc(): Date {
  // Convert "now" into a date-only value in Europe/London, then represent it as a UTC midnight Date.
  // This gives stable week calculations without DST edge cases.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const ymd = fmt.format(new Date()) // YYYY-MM-DD
  return new Date(`${ymd}T00:00:00.000Z`)
}

export async function getAdminToolkitCategories(surgeryId: string): Promise<AdminToolkitCategory[]> {
  const categories = await prisma.adminCategory.findMany({
    where: { surgeryId, deletedAt: null },
    select: { id: true, name: true, orderIndex: true, parentCategoryId: true },
    orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
  })
  
  // Build hierarchy: parents with nested children
  const categoryMap = new Map<string, AdminToolkitCategory>()
  const rootCategories: AdminToolkitCategory[] = []
  
  // First pass: create all category objects
  for (const cat of categories) {
    categoryMap.set(cat.id, { ...cat, parentCategoryId: cat.parentCategoryId, children: [] })
  }
  
  // Second pass: build hierarchy
  for (const cat of categories) {
    const category = categoryMap.get(cat.id)!
    if (cat.parentCategoryId) {
      const parent = categoryMap.get(cat.parentCategoryId)
      if (parent) {
        parent.children!.push(category)
      } else {
        // Orphaned subcategory - treat as root
        rootCategories.push(category)
      }
    } else {
      rootCategories.push(category)
    }
  }
  
  // Sort children within each parent
  const sortCategories = (cats: AdminToolkitCategory[]): AdminToolkitCategory[] => {
    return cats
      .sort((a, b) => {
        if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex
        return a.name.localeCompare(b.name)
      })
      .map((cat) => ({
        ...cat,
        children: cat.children ? sortCategories(cat.children) : undefined,
      }))
  }
  
  return sortCategories(rootCategories)
}

export async function getAdminToolkitPageItems(surgeryId: string): Promise<AdminToolkitPageItem[]> {
  const items = await prisma.adminItem.findMany({
    where: { surgeryId, deletedAt: null, type: { in: ['PAGE', 'LIST'] } },
    select: {
      id: true,
      type: true,
      title: true,
      categoryId: true,
      warningLevel: true,
      contentHtml: true,
      contentJson: true,
      lastReviewedAt: true,
      updatedAt: true,
      createdAt: true,
      ownerUserId: true,
      createdBy: { select: { id: true, name: true, email: true } },
      updatedBy: { select: { id: true, name: true, email: true } },
      editors: { select: { userId: true } },
      attachments: {
        where: { deletedAt: null },
        select: { id: true, label: true, url: true, orderIndex: true, deletedAt: true },
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      },
      listColumns: {
        select: { id: true, key: true, label: true, fieldType: true, orderIndex: true },
        orderBy: [{ orderIndex: 'asc' }],
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })
  return items
}

export async function getAdminToolkitPageItem(surgeryId: string, itemId: string): Promise<AdminToolkitPageItem | null> {
  return prisma.adminItem.findFirst({
    where: { id: itemId, surgeryId, deletedAt: null, type: { in: ['PAGE', 'LIST'] } },
    select: {
      id: true,
      type: true,
      title: true,
      categoryId: true,
      warningLevel: true,
      contentHtml: true,
      contentJson: true,
      lastReviewedAt: true,
      updatedAt: true,
      createdAt: true,
      ownerUserId: true,
      createdBy: { select: { id: true, name: true, email: true } },
      updatedBy: { select: { id: true, name: true, email: true } },
      editors: { select: { userId: true } },
      attachments: {
        where: { deletedAt: null },
        select: { id: true, label: true, url: true, orderIndex: true, deletedAt: true },
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      },
      listColumns: {
        select: { id: true, key: true, label: true, fieldType: true, orderIndex: true },
        orderBy: [{ orderIndex: 'asc' }],
      },
      listRows: {
        where: { deletedAt: null },
        select: { id: true, dataJson: true, orderIndex: true },
        orderBy: [{ orderIndex: 'asc' }],
      },
    },
  })
}

export async function getAdminToolkitPinnedPanel(surgeryId: string): Promise<AdminToolkitPinnedPanel> {
  const panel = await prisma.adminPinnedPanel.findUnique({
    where: { surgeryId },
    select: { taskBuddyText: true, postRouteText: true, updatedAt: true },
  })
  return (
    panel ?? {
      taskBuddyText: null,
      postRouteText: null,
      updatedAt: new Date(0),
    }
  )
}

export async function getAdminToolkitOnTakeWeek(
  surgeryId: string,
  weekCommencing: Date,
): Promise<AdminToolkitOnTakeWeek | null> {
  const row = await prisma.adminOnTakeWeek.findUnique({
    where: { surgeryId_weekCommencing: { surgeryId, weekCommencing } },
    select: { weekCommencing: true, gpName: true },
  })
  return row ?? null
}

