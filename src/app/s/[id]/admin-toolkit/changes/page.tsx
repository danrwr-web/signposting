import 'server-only'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSurgeryMembership } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import {
  getRecentlyChangedHandbookItems,
  DEFAULT_CHANGE_WINDOW_DAYS,
} from '@/server/recentlyChangedHandbookItems'
import {
  getChangesBaselineDate,
  isBaselineActive,
  formatBaselineDate,
} from '@/server/whatsChangedBaseline'
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

    const [surgery, enabled, baselineDate] = await Promise.all([
      prisma.surgery.findUnique({
        where: { id: surgeryId },
        select: { id: true, name: true },
      }),
      isFeatureEnabledForSurgery(surgeryId, 'admin_toolkit'),
      getChangesBaselineDate(surgeryId, 'practiceHandbook'),
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
      DEFAULT_CHANGE_WINDOW_DAYS,
      baselineDate
    )

    // Serialize for client
    const serialisedChanges = recentChanges.map((change) => ({
      ...change,
      changedAt: change.changedAt.toISOString(),
    }))

    // Determine helper text
    const baselineIsActive = isBaselineActive(DEFAULT_CHANGE_WINDOW_DAYS, baselineDate)
    const baselineDateFormatted = baselineDate ? formatBaselineDate(baselineDate) : null

    return (
      <HandbookWhatsChangedClient
        surgery={{ id: surgery.id, name: surgery.name }}
        changes={serialisedChanges}
        windowDays={DEFAULT_CHANGE_WINDOW_DAYS}
        baselineDate={baselineDateFormatted}
        baselineIsActive={baselineIsActive}
      />
    )
  } catch {
    redirect('/unauthorized')
  }
}
