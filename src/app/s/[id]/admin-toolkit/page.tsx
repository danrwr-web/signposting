import 'server-only'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSurgeryMembership } from '@/lib/rbac'
import { canAccessAdminToolkitAdminDashboard } from '@/lib/adminToolkitPermissions'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import AdminToolkitPinnedPanel from '@/components/admin-toolkit/AdminToolkitPinnedPanel'
import {
  getAdminToolkitOnTakeWeek,
  getAdminToolkitLibraryForUser,
  getAdminToolkitPinnedPanel,
  getLondonTodayUtc,
  readAdminToolkitQuickAccessButtons,
  startOfWeekMondayUtc,
  addDaysUtc,
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
  const { id: surgeryIdOrSlug } = await params

  try {
    const { user, surgeryId } = await requireSurgeryMembership(surgeryIdOrSlug)

    // Canonicalise to ID-based route (slug support is back-compat only).
    if (surgeryIdOrSlug !== surgeryId) {
      redirect(`/s/${surgeryId}/admin-toolkit`)
    }

    const [surgery, enabled] = await Promise.all([
      prisma.surgery.findUnique({
        where: { id: surgeryId },
        select: { id: true, name: true, uiConfig: true },
      }),
      isFeatureEnabledForSurgery(surgeryId, 'admin_toolkit'),
    ])

    if (!surgery) {
      redirect('/unauthorized')
    }

    const canManage = canAccessAdminToolkitAdminDashboard(user, surgeryId)

    // Feature-gated (friendly message rather than 404/notFound)
    if (!enabled) {
      return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <p className="text-sm text-yellow-700">
              <strong>Practice Handbook is not enabled for {surgery.name}.</strong> Please contact an administrator if you need access.
            </p>
          </div>
        </div>
      )
    }

    const [{ categories, items }, panel] = await Promise.all([
      getAdminToolkitLibraryForUser(user, surgeryId),
      getAdminToolkitPinnedPanel(surgeryId),
    ])

    const todayUtc = getLondonTodayUtc()
    const weekStartUtc = startOfWeekMondayUtc(todayUtc)
    const weekEndUtc = addDaysUtc(weekStartUtc, 6)
    const onTake = await getAdminToolkitOnTakeWeek(surgeryId, weekStartUtc)
    const quickAccessButtons = readAdminToolkitQuickAccessButtons(surgery.uiConfig)

    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-nhs-dark-blue">Practice Handbook</h1>
              <p className="mt-1 text-nhs-grey">{surgery.name}</p>
            </div>
            <div className="flex items-center gap-3">
              {canManage ? (
                <>
                  <Link
                    href={`/s/${surgeryId}/admin-toolkit/admin`}
                    className="text-sm font-medium text-nhs-blue hover:text-nhs-dark-blue underline-offset-2 hover:underline"
                  >
                    Edit Handbook
                  </Link>
                  <Link href={`/s/${surgeryId}/admin-toolkit/admin`} className="nhs-button">
                    Add page
                  </Link>
                </>
              ) : (
                <span className="text-sm text-gray-500">View only</span>
              )}
            </div>
          </header>

          <AdminToolkitLibraryClient
            surgeryId={surgeryId}
            canWrite={canManage}
            categories={categories}
            items={items}
            quickAccessButtons={quickAccessButtons}
          />

          {/* Desktop: keep pinned panel visible while browsing (no inner scroll regions). */}
          <div className="hidden lg:block">
            <AdminToolkitPinnedPanel
              surgeryId={surgeryId}
              canWrite={canManage}
              onTakeWeekCommencingUtc={weekStartUtc}
              onTakeWeekEndUtc={weekEndUtc}
              onTakeGpName={onTake?.gpName ?? null}
              panel={panel}
              variant="fixed"
            />
          </div>

          {/* Mobile: show inline to avoid covering content on small screens. */}
          <div className="lg:hidden">
            <AdminToolkitPinnedPanel
              surgeryId={surgeryId}
              canWrite={canManage}
              onTakeWeekCommencingUtc={weekStartUtc}
              onTakeWeekEndUtc={weekEndUtc}
              onTakeGpName={onTake?.gpName ?? null}
              panel={panel}
              variant="inline"
            />
          </div>
        </div>
      </div>
    )
  } catch {
    redirect('/unauthorized')
  }
}

