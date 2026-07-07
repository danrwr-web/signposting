import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { computeCollapsePlan, executeCollapsePlan } from '@/server/collapseAgeDuplicates'
import { updateRequiresClinicalReview } from '@/server/updateRequiresClinicalReview'
import { getCachedSymptomsTag } from '@/server/effectiveSymptoms'
import { revalidateTag } from 'next/cache'

export const runtime = 'nodejs'

const collapseSchema = z.object({
  surgeryId: z.string().min(1),
  mode: z.enum(['preview', 'execute']),
})

/**
 * POST /api/admin/symptoms/collapse-age-duplicates
 *
 * Superuser-only companion to the 'hide_age_bands' feature flag: computes
 * (preview) or applies (execute) the disabling of duplicate age versions of
 * symptoms so a no-age-bands surgery shows one card per symptom name.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (user.globalRole !== 'SUPERUSER') {
      return NextResponse.json({ error: 'Superuser required' }, { status: 403 })
    }

    const body = await request.json()
    const { surgeryId, mode } = collapseSchema.parse(body)

    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: { id: true },
    })
    if (!surgery) {
      return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
    }

    const plan = await computeCollapsePlan(surgeryId)

    if (mode === 'execute' && plan.counts.disabledCount > 0) {
      await executeCollapsePlan(surgeryId, plan, user.name || user.email)

      await updateRequiresClinicalReview(surgeryId)
      revalidateTag(getCachedSymptomsTag(surgeryId, false))
      revalidateTag(getCachedSymptomsTag(surgeryId, true))
      revalidateTag('symptoms')
    }

    return NextResponse.json({ mode, ...plan })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Error in collapse-age-duplicates:', error)
    return NextResponse.json({ error: 'Failed to process collapse request' }, { status: 500 })
  }
}
