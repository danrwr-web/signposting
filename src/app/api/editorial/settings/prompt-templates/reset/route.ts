import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { EditorialPromptTemplateResetZ } from '@/lib/schemas/editorial'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/editorial/settings/prompt-templates/reset
 *
 * Deletes the saved template for a given role, reverting to the hardcoded default.
 * Superuser-only.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 },
    )
  }
  if (user.globalRole !== 'SUPERUSER') {
    return NextResponse.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Superuser access required' } },
      { status: 403 },
    )
  }

  try {
    const body = await request.json()
    const parsed = EditorialPromptTemplateResetZ.parse(body)

    // Delete the saved template if it exists (no error if already absent)
    await prisma.dailyDosePromptTemplate.deleteMany({
      where: { role: parsed.role },
    })

    return NextResponse.json({ ok: true, role: parsed.role, message: 'Template reset to default' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 },
      )
    }
    console.error('POST /api/editorial/settings/prompt-templates/reset error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
