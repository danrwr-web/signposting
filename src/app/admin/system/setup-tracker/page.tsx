export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { computeSurgerySetupSnapshotsBatch, HEALTH_WINDOW_DAYS } from '@/server/surgerySetup'
import { evaluateFlags } from '@/server/surgerySetupFlags'
import SetupTrackerClient, { type TrackerRow } from './SetupTrackerClient'

const DAY_MS = 24 * 60 * 60 * 1000

export default async function SetupTrackerPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (user.globalRole !== 'SUPERUSER') redirect('/unauthorized')

  const now = new Date()
  const snapshots = await computeSurgerySetupSnapshotsBatch()

  const rows: TrackerRow[] = snapshots.map(s => {
    const flags = evaluateFlags(s, now)
    const daysSinceCreated = Math.floor((now.getTime() - s.createdAt.getTime()) / DAY_MS)
    const daysSinceLastActivity = s.lastActivityAt
      ? Math.floor((now.getTime() - s.lastActivityAt.getTime()) / DAY_MS)
      : null
    return {
      id: s.surgeryId,
      name: s.surgeryName,
      createdAt: s.createdAt.toISOString(),
      stage: s.stage,
      essentialCount: s.essentialCount,
      essentialTotal: s.essentialTotal,
      recommendedCount: s.recommendedCount,
      recommendedTotal: s.recommendedTotal,
      flags,
      lastActivityAt: s.lastActivityAt?.toISOString() ?? null,
      daysSinceCreated,
      daysSinceLastActivity,
      goLiveDate: s.goLiveDate?.toISOString() ?? null,
      features: s.features,
      onboardingCompleted: s.onboardingCompleted,
      onboardingStarted: s.onboardingStarted,
    }
  })

  return <SetupTrackerClient rows={rows} windowDays={HEALTH_WINDOW_DAYS} generatedAt={now.toISOString()} />
}
