import 'server-only'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess, can } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import AdminToolkitPinnedPanel from '@/components/admin-toolkit/AdminToolkitPinnedPanel'
import AdminToolkitHeader from '@/components/admin-toolkit/AdminToolkitHeader'
import {
  getAdminToolkitCategories,
  getAdminToolkitOnTakeWeek,
  getAdminToolkitPageItems,
  getAdminToolkitPinnedPanel,
  getLondonTodayUtc,
  startOfWeekMondayUtc,
} from '@/server/adminToolkit'
import AdminToolkitLibraryClient from './AdminToolkitLibraryClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface AdminToolkitLandingPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function AdminToolkitLandingPage({ params }: AdminToolkitLandingPageProps) {
  const { id: surgeryId } = await params

  try {
    const user = await requireSurgeryAccess(surgeryId)

    const [surgery, enabled] = await Promise.all([
      prisma.surgery.findUnique({
        where: { id: surgeryId },
        select: { id: true, name: true },
      }),
      isFeatureEnabledForSurgery(surgeryId, 'admin_toolkit'),
    ])

    if (!surgery) {
      redirect('/unauthorized')
    }

    const canWrite = can(user).adminToolkitWrite(surgeryId)

    // Feature-gated (friendly message rather than 404/notFound)
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
                <strong>Admin Toolkit is not enabled for {surgery.name}.</strong> Please contact an administrator if you need access.
              </p>
            </div>
          </div>
        </div>
      )
    }

    const [categories, items, panel] = await Promise.all([
      getAdminToolkitCategories(surgeryId),
      getAdminToolkitPageItems(surgeryId),
      getAdminToolkitPinnedPanel(surgeryId),
    ])

    const todayUtc = getLondonTodayUtc()
    const weekStartUtc = startOfWeekMondayUtc(todayUtc)
    const onTake = await getAdminToolkitOnTakeWeek(surgeryId, weekStartUtc)

    return (
      <div className="bg-white flex flex-col h-[100dvh]">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 min-h-0 flex flex-col">
          <AdminToolkitHeader
            surgeryId={surgeryId}
            surgeryName={surgery.name}
            canWrite={canWrite}
          />

          <div className="flex-1 min-h-0">
            <AdminToolkitLibraryClient
              surgeryId={surgeryId}
              canWrite={canWrite}
              categories={categories}
              items={items}
            />
          </div>
        </div>

        <AdminToolkitPinnedPanel
          surgeryId={surgeryId}
          canWrite={canWrite}
          onTakeWeekCommencingUtc={weekStartUtc}
          onTakeGpName={onTake?.gpName ?? null}
          panel={panel}
        />
      </div>
    )
  } catch {
    redirect('/unauthorized')
  }
}

