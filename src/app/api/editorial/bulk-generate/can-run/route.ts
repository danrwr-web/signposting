import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PREREQUISITE_MESSAGE =
  'Please complete clinical approval of the toolkit before creating your learning card library.'

/**
 * GET /api/editorial/bulk-generate/can-run?surgeryId=xxx&override=1
 * Returns whether the bulk generator can run for the given surgery.
 * Superusers can pass override=1 to bypass the prerequisite check.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { canRun: false, reason: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const targetRole = (searchParams.get('targetRole') === 'GP' || searchParams.get('targetRole') === 'NURSE')
      ? searchParams.get('targetRole')
      : 'ADMIN'
    const surgeryId = resolveSurgeryIdForUser({
      requestedId: searchParams.get('surgeryId') ?? undefined,
      user,
    })
    const override = searchParams.get('override') === '1'
    const isSuperuser = user.globalRole === 'SUPERUSER'

    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { canRun: false, reason: 'Admin access required' },
        { status: 403 }
      )
    }

    // GP/NURSE have no prerequisite; ADMIN requires toolkit + approval (or superuser override)
    if (targetRole !== 'ADMIN') {
      return NextResponse.json({ canRun: true })
    }
    if (isSuperuser && override) {
      return NextResponse.json({ canRun: true })
    }

    const [toolkitEnabled, pendingCount] = await Promise.all([
      isFeatureEnabledForSurgery(surgeryId, 'admin_toolkit'),
      (async () => {
        const enabledSymptoms = await getEffectiveSymptoms(surgeryId, false)
        const allReviewStatuses = await prisma.symptomReviewStatus.findMany({
          where: { surgeryId },
        })
        const reviewedKeys = new Set(
          allReviewStatuses.map((rs) => `${rs.symptomId}-${rs.ageGroup || ''}`)
        )
        const unreviewed = enabledSymptoms.filter((s) => {
          const key = `${s.id}-${s.ageGroup || ''}`
          return !reviewedKeys.has(key)
        }).length
        const explicitPending = allReviewStatuses.filter(
          (rs) => rs.status === 'PENDING'
        ).length
        return unreviewed + explicitPending
      })(),
    ])

    if (!toolkitEnabled) {
      return NextResponse.json({
        canRun: false,
        reason: PREREQUISITE_MESSAGE,
      })
    }

    if (pendingCount > 0) {
      return NextResponse.json({
        canRun: false,
        reason: PREREQUISITE_MESSAGE,
      })
    }

    return NextResponse.json({ canRun: true })
  } catch (error) {
    console.error('GET /api/editorial/bulk-generate/can-run error', error)
    return NextResponse.json(
      { canRun: false, reason: 'Unable to check prerequisites' },
      { status: 500 }
    )
  }
}
