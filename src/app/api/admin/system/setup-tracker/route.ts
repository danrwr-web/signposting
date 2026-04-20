import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import {
  computeSurgerySetupSnapshot,
  computeSurgerySetupSnapshotsBatch,
  HEALTH_WINDOW_DAYS,
  type SurgerySetupSnapshot,
} from '@/server/surgerySetup'
import { evaluateFlags } from '@/server/surgerySetupFlags'

export const runtime = 'nodejs'

const DAY_MS = 24 * 60 * 60 * 1000

function serialise(snapshot: SurgerySetupSnapshot, now: Date) {
  const flags = evaluateFlags(snapshot, now)
  const daysSinceCreated = Math.floor((now.getTime() - snapshot.createdAt.getTime()) / DAY_MS)
  const daysSinceLastActivity = snapshot.lastActivityAt
    ? Math.floor((now.getTime() - snapshot.lastActivityAt.getTime()) / DAY_MS)
    : null
  return {
    id: snapshot.surgeryId,
    name: snapshot.surgeryName,
    createdAt: snapshot.createdAt.toISOString(),
    stage: snapshot.stage,
    essentialCount: snapshot.essentialCount,
    essentialTotal: snapshot.essentialTotal,
    recommendedCount: snapshot.recommendedCount,
    recommendedTotal: snapshot.recommendedTotal,
    checklist: snapshot.checklist,
    health: snapshot.health,
    flags,
    lastActivityAt: snapshot.lastActivityAt?.toISOString() ?? null,
    daysSinceCreated,
    daysSinceLastActivity,
    goLiveDate: snapshot.goLiveDate?.toISOString() ?? null,
    features: snapshot.features,
    onboardingStarted: snapshot.onboardingStarted,
    onboardingCompleted: snapshot.onboardingCompleted,
    onboardingCompletedAt: snapshot.onboardingCompletedAt?.toISOString() ?? null,
  }
}

// GET /api/admin/system/setup-tracker[?ids=a,b,c][&lightweight=true|false]
export async function GET(request: NextRequest) {
  try {
    await requireSuperuser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')
    const ids = idsParam ? idsParam.split(',').map(s => s.trim()).filter(Boolean) : undefined
    const lightweightParam = searchParams.get('lightweight')
    // Default: lightweight for list view. If specific ids are requested, assume
    // the caller wants the full per-surgery snapshot unless they opt out.
    const lightweight = lightweightParam === null ? !ids : lightweightParam === 'true'

    const now = new Date()
    let snapshots: SurgerySetupSnapshot[]
    if (lightweight) {
      snapshots = await computeSurgerySetupSnapshotsBatch(ids)
    } else if (ids && ids.length > 0) {
      const results = await Promise.all(ids.map(id => computeSurgerySetupSnapshot(id)))
      snapshots = results.filter((r): r is SurgerySetupSnapshot => r !== null)
    } else {
      // Full mode across all surgeries is expensive; fall back to batch.
      snapshots = await computeSurgerySetupSnapshotsBatch()
    }

    return NextResponse.json({
      generatedAt: now.toISOString(),
      windowDays: HEALTH_WINDOW_DAYS,
      lightweight,
      surgeries: snapshots.map(s => serialise(s, now)),
    })
  } catch (error) {
    console.error('Error fetching setup tracker data:', error)
    return NextResponse.json({ error: 'Failed to fetch setup tracker data' }, { status: 500 })
  }
}
