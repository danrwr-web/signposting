export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { computeSurgerySetupSnapshotsBatch } from '@/server/surgerySetup'
import { evaluateFlags } from '@/server/surgerySetupFlags'
import SystemManagementClient from './SystemManagementClient'

export default async function SystemManagementPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  // Only superusers can access System Management
  if (user.globalRole !== 'SUPERUSER') {
    redirect('/unauthorized')
  }

  const [surgeryCount, userCount, trackerSnapshots, pendingSuggestionCount] = await Promise.all([
    prisma.surgery.count(),
    prisma.user.count(),
    computeSurgerySetupSnapshotsBatch(),
    // Symptom-content suggestions are triaged by each practice's own admins,
    // so they don't count towards the superuser's pending badge.
    prisma.suggestion.count({
      where: { status: 'PENDING', type: { not: 'SYMPTOM_CONTENT' } },
    }),
  ])

  const now = new Date()
  let flaggedCount = 0
  let criticalCount = 0
  for (const snap of trackerSnapshots) {
    const flags = evaluateFlags(snap, now)
    if (flags.length > 0) flaggedCount += 1
    if (flags.some(f => f.severity === 'critical')) criticalCount += 1
  }

  // Get global defaults (if any exist)
  // For now, we'll use the hardcoded default from recentlyChangedSymptoms.ts
  // In future, this could be stored in a SystemConfig table
  const globalDefaults = {
    recentChangesWindowDays: 14, // DEFAULT_CHANGE_WINDOW_DAYS
  }

  return (
    <SystemManagementClient
      surgeryCount={surgeryCount}
      userCount={userCount}
      globalDefaults={globalDefaults}
      setupTracker={{ flaggedCount, criticalCount }}
      pendingSuggestionCount={pendingSuggestionCount}
    />
  )
}
