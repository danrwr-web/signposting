import 'server-only'

import { NextRequest, NextResponse, after } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { prisma } from '@/lib/prisma'
import { runBulkGeneration } from '@/server/editorial/runBulkGeneration'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const PREREQUISITE_MESSAGE =
  'Please complete clinical approval of the toolkit before creating your learning card library.'

/**
 * POST /api/editorial/bulk-generate/start
 * Starts a bulk generation run. Requires Signposting Toolkit setup + clinical approval.
 * Superusers can pass body.override = true to bypass the prerequisite check.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const surgeryId = resolveSurgeryIdForUser({
      requestedId: body.surgeryId ?? undefined,
      user,
    })
    const override = body.override === true
    const isSuperuser = user.globalRole === 'SUPERUSER'

    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    if (!isSuperuser || !override) {
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

      if (!toolkitEnabled || pendingCount > 0) {
        return NextResponse.json({
          ok: false,
          error: {
            code: 'PREREQUISITE_NOT_MET',
            message: PREREQUISITE_MESSAGE,
          },
        })
      }
    }

    const run = await prisma.bulkGenerationRun.create({
      data: {
        surgeryId,
        createdBy: user.id,
        status: 'PENDING',
        totalSubsections: 0,
      },
    })

    after(async () => {
      await runBulkGeneration(run.id)
    })

    return NextResponse.json({
      ok: true,
      bulkRunId: run.id,
      message: 'Bulk generation started. Cards will appear in the library as they are created.',
    })
  } catch (error) {
    console.error('POST /api/editorial/bulk-generate/start error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
