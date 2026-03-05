import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { prisma } from '@/lib/prisma'
import { inngest } from '@/inngest/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

    try {
      await inngest.send({
        name: 'editorial/bulk.generate.start',
        data: {
          bulkRunId: run.id,
          surgeryId,
          createdBy: user.id,
        },
      })
    } catch (sendError) {
      console.error('inngest.send failed', sendError)
      const msg = sendError instanceof Error ? sendError.message : String(sendError)
      if (
        msg.includes('INNGEST') ||
        msg.includes('event key') ||
        msg.includes('EventKey') ||
        msg.includes('fetch')
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: 'BACKGROUND_JOBS_NOT_CONFIGURED',
              message:
                'Background job service is not configured. Add INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY to your deployment, or install the Inngest Vercel integration.',
            },
          },
          { status: 503 }
        )
      }
      throw sendError
    }

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
