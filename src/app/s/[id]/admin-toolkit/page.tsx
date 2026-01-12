import 'server-only'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess, can } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import AdminToolkitPinnedPanel from '@/components/admin-toolkit/AdminToolkitPinnedPanel'
import {
  getAdminToolkitCategories,
  getAdminToolkitDutyToday,
  getAdminToolkitDutyWeek,
  getAdminToolkitPageItems,
  getAdminToolkitPinnedPanel,
  startOfDayUtc,
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

    const todayUtc = startOfDayUtc(new Date())
    const weekStartUtc = startOfWeekMondayUtc(todayUtc)
    const [todayDuty, weekDuty] = await Promise.all([
      getAdminToolkitDutyToday(surgeryId, todayUtc),
      getAdminToolkitDutyWeek(surgeryId, weekStartUtc),
    ])

    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 pb-44">
          <div className="mb-6 flex items-center justify-between gap-4">
            <Link
              href={`/s/${surgeryId}`}
              className="text-sm font-medium text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
              ← Back to Signposting
            </Link>

            {canWrite ? (
              <Link
                href={`/s/${surgeryId}/admin-toolkit/admin`}
                className="text-sm font-medium text-nhs-blue hover:text-nhs-dark-blue underline-offset-2 hover:underline"
              >
                Manage Admin Toolkit
              </Link>
            ) : (
              <span className="text-sm text-gray-500">View only</span>
            )}
          </div>

          <header className="mb-6">
            <h1 className="text-3xl font-bold text-nhs-dark-blue">Admin Toolkit</h1>
            <p className="mt-1 text-nhs-grey">{surgery.name}</p>
          </header>

          <AdminToolkitLibraryClient
            surgeryId={surgeryId}
            canWrite={canWrite}
            categories={categories}
            items={items}
          />
        </div>

        <AdminToolkitPinnedPanel today={todayDuty} week={weekDuty} weekStartUtc={weekStartUtc} panel={panel} />
      </div>
    )
  } catch {
    redirect('/unauthorized')
  }
}

