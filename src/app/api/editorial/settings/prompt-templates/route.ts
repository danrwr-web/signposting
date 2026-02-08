import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { EditorialPromptTemplateUpdateZ } from '@/lib/schemas/editorial'
import { buildDefaultSystemPrompt } from '@/server/editorialAi'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES = ['ADMIN', 'GP', 'NURSE'] as const

/**
 * GET /api/editorial/settings/prompt-templates
 *
 * Returns all three role templates. For each role, returns either the
 * saved (custom) template or the hardcoded default, plus an `isCustom` flag.
 * Superuser-only.
 */
export async function GET() {
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

  const saved = await prisma.dailyDosePromptTemplate.findMany({
    select: { role: true, template: true, updatedAt: true, updatedBy: true },
  })

  const savedByRole = new Map(saved.map((s) => [s.role, s]))

  const templates = ROLES.map((role) => {
    const entry = savedByRole.get(role)
    const defaultTemplate = buildDefaultSystemPrompt(role)
    return {
      role,
      template: entry?.template ?? defaultTemplate,
      defaultTemplate,
      isCustom: !!entry,
      updatedAt: entry?.updatedAt ?? null,
      updatedBy: entry?.updatedBy ?? null,
    }
  })

  return NextResponse.json({ ok: true, templates })
}

/**
 * PUT /api/editorial/settings/prompt-templates
 *
 * Upserts a custom system prompt template for a given role.
 * Superuser-only.
 */
export async function PUT(request: NextRequest) {
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
    const parsed = EditorialPromptTemplateUpdateZ.parse(body)

    const result = await prisma.dailyDosePromptTemplate.upsert({
      where: { role: parsed.role },
      create: {
        role: parsed.role,
        template: parsed.template,
        updatedBy: user.id,
      },
      update: {
        template: parsed.template,
        updatedBy: user.id,
      },
      select: { role: true, template: true, updatedAt: true },
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 },
      )
    }
    console.error('PUT /api/editorial/settings/prompt-templates error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
