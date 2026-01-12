import 'server-only'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess, can } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface AdminToolkitItemPageProps {
  params: Promise<{
    id: string
    itemId: string
  }>
}

export default async function AdminToolkitItemPage({ params }: AdminToolkitItemPageProps) {
  const { id: surgeryId, itemId } = await params

  try {
    const user = await requireSurgeryAccess(surgeryId)
    const [enabled, surgery] = await Promise.all([
      isFeatureEnabledForSurgery(surgeryId, 'admin_toolkit'),
      prisma.surgery.findUnique({ where: { id: surgeryId }, select: { id: true, name: true } }),
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

    // Item loading will be implemented shortly; for now, render shell so the route resolves.
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 pb-40">
          <div className="mb-6 flex items-center justify-between gap-4">
            <Link
              href={`/s/${surgeryId}/admin-toolkit`}
              className="text-sm font-medium text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
              ← Back to Admin Toolkit
            </Link>
            {canWrite ? (
              <Link
                href={`/s/${surgeryId}/admin-toolkit/admin`}
                className="text-sm font-medium text-nhs-blue hover:text-nhs-dark-blue underline-offset-2 hover:underline"
              >
                Manage
              </Link>
            ) : (
              <span className="text-sm text-gray-500">View only</span>
            )}
          </div>

          <header className="mb-6">
            <h1 className="text-3xl font-bold text-nhs-dark-blue">Admin Toolkit item</h1>
            <p className="mt-1 text-nhs-grey">
              {surgery.name} • Item ID: <span className="font-mono text-xs">{itemId}</span>
            </p>
          </header>

          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-nhs-grey">Item rendering will be wired next.</p>
          </div>
        </div>

        {/* Pinned panel (stub for now; will be wired to DB) */}
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <section>
                  <h2 className="text-sm font-semibold text-nhs-dark-blue">GP taking on</h2>
                  <p className="mt-1 text-sm text-nhs-grey">Rota coming soon.</p>
                </section>
                <section>
                  <h2 className="text-sm font-semibold text-nhs-dark-blue">Task buddy system</h2>
                  <p className="mt-1 text-sm text-nhs-grey">Coming soon.</p>
                </section>
                <section>
                  <h2 className="text-sm font-semibold text-nhs-dark-blue">Post route</h2>
                  <p className="mt-1 text-sm text-nhs-grey">Coming soon.</p>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  } catch {
    redirect('/unauthorized')
  }
}

