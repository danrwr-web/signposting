import 'server-only'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { sanitizeAndFormatContent } from '@/lib/sanitizeHtml'
import { canAccessAdminToolkitAdminDashboard, canEditAdminItem } from '@/lib/adminToolkitPermissions'
import AdminToolkitPinnedPanel from '@/components/admin-toolkit/AdminToolkitPinnedPanel'
import RoleCardsRendererWithCardStyle from '@/components/admin-toolkit/RoleCardsRendererWithCardStyle'
import {
  getAdminToolkitOnTakeWeek,
  getAdminToolkitPageItemForUser,
  getAdminToolkitPinnedPanel,
  getLondonTodayUtc,
  startOfWeekMondayUtc,
} from '@/server/adminToolkit'
import AdminToolkitItemActionsClient from './AdminToolkitItemActionsClient'
import AdminToolkitAttachmentsClient from './AdminToolkitAttachmentsClient'
import AdminToolkitListClient from './AdminToolkitListClient'
import { getRoleCardsBlock, getIntroTextBlock, getFooterTextBlock } from '@/lib/adminToolkitContentBlocksShared'

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

    const item = await getAdminToolkitPageItemForUser(user, surgeryId, itemId)
    if (!item) {
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
                <strong>That item could not be found.</strong> It may have been deleted.
              </p>
            </div>
          </div>
        </div>
      )
    }

    const canManage = canAccessAdminToolkitAdminDashboard(user, surgeryId)
    const canEditThisItem = canEditAdminItem(user, {
      id: item.id,
      surgeryId,
      categoryId: item.categoryId,
      editGrants: item.editGrants.map((g) => ({
        principalType: g.principalType,
        userId: g.userId ?? null,
        role: (g.role ?? null) as 'ADMIN' | 'STANDARD' | null,
      })),
    })
    const roleCardsBlock = item.type === 'PAGE' ? getRoleCardsBlock(item.contentJson ?? null) : null
    const introTextBlock = item.type === 'PAGE' ? getIntroTextBlock(item.contentJson ?? null) : null
    const footerTextBlock = item.type === 'PAGE' ? getFooterTextBlock(item.contentJson ?? null) : null
    // Legacy fallback: if no FOOTER_TEXT block but contentHtml exists, use it as footer
    const footerHtml = footerTextBlock?.html ?? (item.type === 'PAGE' && item.contentHtml ? item.contentHtml : '')

    const panel = await getAdminToolkitPinnedPanel(surgeryId)
    const todayUtc = getLondonTodayUtc()
    const weekStartUtc = startOfWeekMondayUtc(todayUtc)
    const onTake = await getAdminToolkitOnTakeWeek(surgeryId, weekStartUtc)

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
            <AdminToolkitItemActionsClient
              surgeryId={surgeryId}
              itemId={item.id}
              canManage={canManage}
              canEditThisItem={canEditThisItem}
            />
          </div>

          <header className="mb-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-3xl font-bold text-nhs-dark-blue">{item.title}</h1>
              {item.warningLevel ? (
                <span className="inline-flex items-center rounded-full bg-yellow-50 px-3 py-1 text-sm font-medium text-yellow-800 border border-yellow-200">
                  {item.warningLevel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-nhs-grey">{surgery.name}</p>
          </header>

          {item.type === 'PAGE' ? (
            <>
              <div className="bg-white rounded-lg shadow-md p-6">
                {introTextBlock ? (
                  <div
                    className="prose max-w-none mb-6"
                    dangerouslySetInnerHTML={{ __html: sanitizeAndFormatContent(introTextBlock.html) }}
                  />
                ) : null}
                {roleCardsBlock ? <RoleCardsRendererWithCardStyle block={roleCardsBlock} /> : null}
                {footerHtml ? (
                  <div
                    className={`prose max-w-none ${roleCardsBlock ? 'mt-6' : ''}`}
                    dangerouslySetInnerHTML={{ __html: sanitizeAndFormatContent(footerHtml) }}
                  />
                ) : null}
              </div>

              <section className="mt-6 bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-nhs-dark-blue">Attachments</h2>
                <p className="mt-1 text-sm text-nhs-grey">Add links to PDFs, Word documents, images, or folders.</p>
                <div className="mt-4">
                  <AdminToolkitAttachmentsClient
                    surgeryId={surgeryId}
                    itemId={item.id}
                    canEditThisItem={canEditThisItem}
                    attachments={item.attachments.map((a) => ({ id: a.id, label: a.label, url: a.url }))}
                  />
                </div>
              </section>
            </>
          ) : (
            <section className="bg-white rounded-lg shadow-md p-6">
              <AdminToolkitListClient
                surgeryId={surgeryId}
                itemId={item.id}
                canEditThisItem={canEditThisItem}
                columns={(item.listColumns ?? []).map((c) => ({ id: c.id, key: c.key, label: c.label, fieldType: c.fieldType, orderIndex: c.orderIndex }))}
                rows={(item.listRows ?? []).map((r) => {
                  const raw = r.dataJson
                  const obj =
                    raw && typeof raw === 'object' && !Array.isArray(raw)
                      ? (raw as Record<string, unknown>)
                      : ({} as Record<string, unknown>)
                  const data: Record<string, string> = {}
                  for (const [k, v] of Object.entries(obj)) data[k] = v === null || v === undefined ? '' : String(v)
                  return { id: r.id, data, orderIndex: r.orderIndex }
                })}
              />
            </section>
          )}

          <footer className="mt-6 text-sm text-gray-600">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <div>
                <span className="text-gray-500">Created by:</span>{' '}
                <span className="font-medium">{item.createdBy ? item.createdBy.name || item.createdBy.email : 'Not set'}</span>
              </div>
              <div>
                <span className="text-gray-500">Last updated by:</span>{' '}
                <span className="font-medium">{item.updatedBy ? item.updatedBy.name || item.updatedBy.email : 'Not set'}</span>
              </div>
              <div>
                <span className="text-gray-500">Last reviewed:</span>{' '}
                <span className="font-medium">
                  {item.lastReviewedAt ? new Date(item.lastReviewedAt).toLocaleDateString('en-GB') : 'Not set'}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Updated:</span>{' '}
                <span className="font-medium">{new Date(item.updatedAt).toLocaleDateString('en-GB')}</span>
              </div>
            </div>
          </footer>
        </div>

        <AdminToolkitPinnedPanel
          surgeryId={surgeryId}
            canWrite={canManage}
          onTakeWeekCommencingUtc={weekStartUtc}
          onTakeGpName={onTake?.gpName ?? null}
          panel={panel}
          variant="inline"
        />
      </div>
    )
  } catch {
    redirect('/unauthorized')
  }
}

