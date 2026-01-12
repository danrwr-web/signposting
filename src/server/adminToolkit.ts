import 'server-only'

import { prisma } from '@/lib/prisma'

export type AdminToolkitCategory = {
  id: string
  name: string
  orderIndex: number
}

export type AdminToolkitPageItem = {
  id: string
  title: string
  categoryId: string | null
  warningLevel: string | null
  contentHtml: string | null
  lastReviewedAt: Date | null
  updatedAt: Date
  createdAt: Date
  ownerUserId: string | null
  editors: Array<{ userId: string }>
  attachments: Array<{ id: string; label: string; url: string; orderIndex: number; deletedAt: Date | null }>
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
    select: { id: true, name: true, orderIndex: true },
    orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
  })
  return categories
}

export async function getAdminToolkitPageItems(surgeryId: string): Promise<AdminToolkitPageItem[]> {
  const items = await prisma.adminItem.findMany({
    where: { surgeryId, deletedAt: null, type: 'PAGE' },
    select: {
      id: true,
      title: true,
      categoryId: true,
      warningLevel: true,
      contentHtml: true,
      lastReviewedAt: true,
      updatedAt: true,
      createdAt: true,
      ownerUserId: true,
      editors: { select: { userId: true } },
      attachments: {
        where: { deletedAt: null },
        select: { id: true, label: true, url: true, orderIndex: true, deletedAt: true },
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  })
  return items
}

export async function getAdminToolkitPageItem(
  surgeryId: string,
  itemId: string,
): Promise<AdminToolkitPageItem | null> {
  return prisma.adminItem.findFirst({
    where: { id: itemId, surgeryId, deletedAt: null, type: 'PAGE' },
    select: {
      id: true,
      title: true,
      categoryId: true,
      warningLevel: true,
      contentHtml: true,
      lastReviewedAt: true,
      updatedAt: true,
      createdAt: true,
      ownerUserId: true,
      editors: { select: { userId: true } },
      attachments: {
        where: { deletedAt: null },
        select: { id: true, label: true, url: true, orderIndex: true, deletedAt: true },
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
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

