import 'server-only'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { canEditAdminItem } from '@/lib/adminToolkitPermissions'
import { getAdminToolkitPageItemForUser } from '@/server/adminToolkit'
import AdminToolkitItemEditClient from './AdminToolkitItemEditClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface AdminToolkitItemEditPageProps {
  params: Promise<{ id: string; itemId: string }>
}

export default async function AdminToolkitItemEditPage({ params }: AdminToolkitItemEditPageProps) {
  const { id: surgeryId, itemId } = await params

  try {
    const user = await requireSurgeryAccess(surgeryId)
    const [enabled, surgery] = await Promise.all([
      isFeatureEnabledForSurgery(surgeryId, 'admin_toolkit'),
      prisma.surgery.findUnique({ where: { id: surgeryId }, select: { id: true, name: true } }),
    ])

    if (!surgery) redirect('/unauthorized')

    if (!enabled) {
      return (
        <div className="min-h-screen bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
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

    const item = await getAdminToolkitPageItemForUser(user, surgeryId, itemId)
    if (!item) {
      return (
        <div className="min-h-screen bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
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
                <strong>That item could not be found.</strong> It may have been deleted.
              </p>
            </div>
          </div>
        </div>
      )
    }

    const canEdit = canEditAdminItem(user, {
      id: item.id,
      surgeryId,
      categoryId: item.categoryId,
      editGrants: item.editGrants.map((g) => ({
        principalType: g.principalType,
        userId: g.userId ?? null,
        role: (g.role ?? null) as 'ADMIN' | 'STANDARD' | null,
      })),
    })

    if (!canEdit) {
      return (
        <div className="min-h-screen bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="mb-6">
              <Link
                href={`/s/${surgeryId}/admin-toolkit/${item.id}`}
                className="text-sm font-medium text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              >
                ← Back to item
              </Link>
            </div>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-sm text-yellow-700">
                <strong>You do not have permission to edit this item.</strong>
              </p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="mb-6">
            <Link
              href={`/s/${surgeryId}/admin-toolkit/${item.id}`}
              className="text-sm font-medium text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
              ← Back to item
            </Link>
          </div>

          <header className="mb-6">
            <h1 className="text-3xl font-bold text-nhs-dark-blue">Edit item</h1>
            <p className="mt-1 text-nhs-grey">
              {surgery.name} • Admin Toolkit
            </p>
            <p className="mt-2 text-sm text-gray-600">
              This editor is for updating the content of this item only. For categories, quick access buttons, and the pinned panel, use the Admin Toolkit admin page.
            </p>
          </header>

          <AdminToolkitItemEditClient
            surgeryId={surgeryId}
            itemId={item.id}
            initial={{
              type: item.type,
              title: item.title,
              warningLevel: item.warningLevel,
              contentHtml: item.contentHtml,
              contentJson: item.contentJson ?? null,
              lastReviewedAtIso: item.lastReviewedAt ? new Date(item.lastReviewedAt).toISOString().slice(0, 10) : '',
            }}
          />
        </div>
      </div>
    )
  } catch {
    redirect('/unauthorized')
  }
}

