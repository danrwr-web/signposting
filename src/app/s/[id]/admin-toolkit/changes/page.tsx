import 'server-only'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSurgeryMembership } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import {
  getRecentlyChangedHandbookItems,
  DEFAULT_CHANGE_WINDOW_DAYS,
} from '@/server/recentlyChangedHandbookItems'
import HandbookWhatsChangedClient from './HandbookWhatsChangedClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface HandbookChangesPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function HandbookChangesPage({ params }: HandbookChangesPageProps) {
  const { id: surgeryIdOrSlug } = await params

  try {
    const { user, surgeryId } = await requireSurgeryMembership(surgeryIdOrSlug)

    // Canonicalise to ID-based route (slug support is back-compat only).
    if (surgeryIdOrSlug !== surgeryId) {
      redirect(`/s/${surgeryId}/admin-toolkit/changes`)
    }

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

    // Feature-gated
    if (!enabled) {
      redirect(`/s/${surgeryId}`)
    }

    const recentChanges = await getRecentlyChangedHandbookItems(
      user,
      surgeryId,
      DEFAULT_CHANGE_WINDOW_DAYS
    )

    // Serialize for client
    const serialisedChanges = recentChanges.map((change) => ({
      ...change,
      changedAt: change.changedAt.toISOString(),
    }))

    return (
      <HandbookWhatsChangedClient
        surgery={{ id: surgery.id, name: surgery.name }}
        changes={serialisedChanges}
        windowDays={DEFAULT_CHANGE_WINDOW_DAYS}
      />
    )
  } catch {
    redirect('/unauthorized')
  }
}
