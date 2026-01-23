import 'server-only'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess } from '@/lib/rbac'
import { canAccessAdminToolkitAdminDashboard } from '@/lib/adminToolkitPermissions'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import {
  getAdminToolkitCategories,
  getAdminToolkitOnTakeWeek,
  getAdminToolkitPageItems,
  getAdminToolkitPinnedPanel,
  getLondonTodayUtc,
  addDaysUtc,
  readAdminToolkitQuickAccessButtons,
  startOfWeekMondayUtc,
} from '@/server/adminToolkit'
import AdminToolkitAdminClient from './AdminToolkitAdminClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const __VERCEL_REDEPLOY_BUMP__ = 'BUMP-2026-01-20T12:00:00Z'

interface AdminToolkitAdminPageProps {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminToolkitAdminPage({ params, searchParams }: AdminToolkitAdminPageProps) {
  const { id: surgeryId } = await params
  const sp = (await searchParams) ?? {}
  const initialItemId = typeof sp.item === 'string' ? sp.item : undefined
  const initialTab = typeof sp.tab === 'string' && (sp.tab === 'items' || sp.tab === 'settings') ? sp.tab : 'items'

  try {
    const user = await requireSurgeryAccess(surgeryId)
    const [surgery, enabled] = await Promise.all([
      prisma.surgery.findUnique({ where: { id: surgeryId }, select: { id: true, name: true, uiConfig: true } }),
      isFeatureEnabledForSurgery(surgeryId, 'admin_toolkit'),
    ])

    if (!surgery) {
      redirect('/unauthorized')
    }

    if (!enabled) {
      return (
        <div className="min-h-screen bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-sm text-yellow-700">
                <strong>Practice Handbook is not enabled for {surgery.name}.</strong>
              </p>
            </div>
          </div>
        </div>
      )
    }

    const canManage = canAccessAdminToolkitAdminDashboard(user, surgeryId)
    if (!canManage) {
      redirect('/unauthorized')
    }

    const todayUtc = getLondonTodayUtc()
    const weekStartUtc = startOfWeekMondayUtc(todayUtc)

    const upcomingWeekStarts = Array.from({ length: 8 }).map((_, i) => addDaysUtc(weekStartUtc, i * 7))
    const upcomingWeekEnd = addDaysUtc(weekStartUtc, 8 * 7)

    const [categories, items, panel, onTakeWeek, onTakeUpcoming, members] = await Promise.all([
      getAdminToolkitCategories(surgeryId),
      getAdminToolkitPageItems(surgeryId),
      getAdminToolkitPinnedPanel(surgeryId),
      getAdminToolkitOnTakeWeek(surgeryId, weekStartUtc),
      prisma.adminOnTakeWeek.findMany({
        where: { surgeryId, weekCommencing: { gte: weekStartUtc, lt: upcomingWeekEnd } },
        select: { weekCommencing: true, gpName: true },
        orderBy: [{ weekCommencing: 'asc' }],
      }),
      prisma.userSurgery.findMany({
        where: { surgeryId },
        select: {
          role: true,
          adminToolkitWrite: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ role: 'desc' }],
      }),
    ])

    const editorCandidates = members
      .map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email }))
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))

    const quickAccessButtons = readAdminToolkitQuickAccessButtons(surgery.uiConfig)

    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-nhs-dark-blue">Practice Handbook settings</h1>
              <p className="mt-1 text-nhs-grey">{surgery.name}</p>
            </div>
            <Link
              href={`/s/${surgeryId}/admin/users`}
              className="text-sm font-medium text-nhs-blue hover:text-nhs-dark-blue underline-offset-2 hover:underline"
            >
              Manage write access
            </Link>
          </header>

          <AdminToolkitAdminClient
            surgeryId={surgeryId}
            currentWeekCommencingIso={weekStartUtc.toISOString().slice(0, 10)}
            initialWeekCommencingIso={weekStartUtc.toISOString().slice(0, 10)}
            initialOnTakeGpName={onTakeWeek?.gpName ?? null}
            upcomingWeeks={upcomingWeekStarts.map((d) => {
              const iso = d.toISOString().slice(0, 10)
              const match = onTakeUpcoming.find((x) => x.weekCommencing.toISOString().slice(0, 10) === iso)
              return { weekCommencingIso: iso, gpName: match?.gpName ?? null }
            })}
            initialPanel={panel}
            initialCategories={categories}
            initialItems={items}
            editorCandidates={editorCandidates}
            initialQuickAccessButtons={quickAccessButtons}
            initialItemId={initialItemId}
            initialTab={initialTab}
          />
        </div>
      </div>
    )
  } catch {
    redirect('/unauthorized')
  }
}

