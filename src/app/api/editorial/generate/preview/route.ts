import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { EditorialGenerateRequestZ } from '@/lib/schemas/editorial'
import { buildEditorialPrompts } from '@/server/editorialAi'
import { resolveTargetRole } from '@/lib/editorial/roleRouting'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/editorial/generate/preview
 *
 * Superuser-only endpoint that builds the fully constructed system and user
 * prompts without calling the AI. Returns the prompts so the superuser can
 * review (and optionally edit) them before triggering actual generation.
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const parsed = EditorialGenerateRequestZ.parse(body)

    const surgeryId = resolveSurgeryIdForUser({ requestedId: parsed.surgeryId, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 },
      )
    }

    const resolvedRole = resolveTargetRole({
      promptText: parsed.promptText,
      requestedRole: parsed.targetRole,
    })

    const availableTags = await prisma.dailyDoseTag.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    })
    const availableTagNames = availableTags.map((t) => t.name)

    const result = await buildEditorialPrompts({
      surgeryId,
      promptText: parsed.promptText,
      targetRole: resolvedRole,
      count: parsed.count,
      interactiveFirst: parsed.interactiveFirst,
      availableTagNames: availableTagNames.length > 0 ? availableTagNames : undefined,
    })

    return NextResponse.json({
      ok: true,
      systemPrompt: result.systemPrompt,
      userPrompt: result.userPrompt,
      toolkitMeta: result.toolkitMeta,
      resolvedRole,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 },
      )
    }
    console.error('POST /api/editorial/generate/preview error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
