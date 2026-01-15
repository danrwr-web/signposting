import 'server-only'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess, can } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import {
  getAdminToolkitCategories,
  getAdminToolkitOnTakeWeek,
  getAdminToolkitPageItems,
  getAdminToolkitPinnedPanel,
  getAdminQuickLinks,
  getLondonTodayUtc,
  addDaysUtc,
  startOfWeekMondayUtc,
} from '@/server/adminToolkit'
import AdminToolkitAdminClient from './AdminToolkitAdminClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface AdminToolkitAdminPageProps {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminToolkitAdminPage({ params, searchParams }: AdminToolkitAdminPageProps) {
  const { id: surgeryId } = await params
  const sp = (await searchParams) ?? {}
  const initialItemId = typeof sp.item === 'string' ? sp.item : undefined

  try {
    const user = await requireSurgeryAccess(surgeryId)
    const [surgery, enabled] = await Promise.all([
      prisma.surgery.findUnique({ where: { id: surgeryId }, select: { id: true, name: true } }),
      isFeatureEnabledForSurgery(surgeryId, 'admin_toolkit'),
    ])

    if (!surgery) {
      redirect('/unauthorized')
    }

    if (!enabled) {
      return (
        <div className="min-h-screen bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="mb-6">
              <Link
                href={`/s/${surgeryId}`}
                className="text-sm font-medium text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              >
                ← Back to Signposting
              </Link>
            </div>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-sm text-yellow-700">
                <strong>Admin Toolkit is not enabled for {surgery.name}.</strong>
              </p>
            </div>
          </div>
        </div>
      )
    }

    const canWrite = can(user).adminToolkitWrite(surgeryId)
    if (!canWrite) {
      return (
        <div className="min-h-screen bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="mb-6">
              <Link
                href={`/s/${surgeryId}/admin-toolkit`}
                className="text-sm font-medium text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              >
                ← Back to Admin Toolkit
              </Link>
            </div>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-sm text-yellow-700">
                <strong>You have view-only access.</strong> Ask a surgery admin to grant Admin Toolkit write access.
              </p>
            </div>
          </div>
        </div>
      )
    }

    const todayUtc = getLondonTodayUtc()
    const weekStartUtc = startOfWeekMondayUtc(todayUtc)

    const upcomingWeekStarts = Array.from({ length: 8 }).map((_, i) => addDaysUtc(weekStartUtc, i * 7))
    const upcomingWeekEnd = addDaysUtc(weekStartUtc, 8 * 7)

    const [categories, items, panel, quickLinks, onTakeWeek, onTakeUpcoming, members] = await Promise.all([
      getAdminToolkitCategories(surgeryId),
      getAdminToolkitPageItems(surgeryId),
      getAdminToolkitPinnedPanel(surgeryId),
      getAdminQuickLinks(surgeryId),
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
      .filter((m) => m.role === 'ADMIN' || m.adminToolkitWrite === true)
      .map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email }))
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email))

    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="mb-6 flex items-center justify-between gap-4">
            <Link
              href={`/s/${surgeryId}/admin-toolkit`}
              className="text-sm font-medium text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
              ← Back to Admin Toolkit
            </Link>
            <Link
              href={`/s/${surgeryId}/admin/users`}
              className="text-sm font-medium text-nhs-blue hover:text-nhs-dark-blue underline-offset-2 hover:underline"
            >
              Manage write access
            </Link>
          </div>

          <header className="mb-6">
            <h1 className="text-3xl font-bold text-nhs-dark-blue">Admin Toolkit settings</h1>
            <p className="mt-1 text-nhs-grey">{surgery.name}</p>
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
            initialQuickLinks={quickLinks}
            editorCandidates={editorCandidates}
            initialItemId={initialItemId}
          />
        </div>
      </div>
    )
  } catch {
    redirect('/unauthorized')
  }
}

