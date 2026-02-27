import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { LearningCategoryCreateZ } from '@/lib/schemas/editorial'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/editorial/settings/learning-categories
 *
 * Returns all learning categories (active and inactive).
 * Available to any authenticated editorial user for dropdown population.
 * Inactive categories are included so superusers can reactivate them.
 */
export async function GET() {
  try {
    const categories = await prisma.learningCategory.findMany({
      orderBy: [{ ordering: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        ordering: true,
        isActive: true,
        subsections: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { cards: true },
        },
      },
    })

    return NextResponse.json({ ok: true, categories })
  } catch (error) {
    console.error('GET /api/editorial/settings/learning-categories error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}

/**
 * POST /api/editorial/settings/learning-categories
 *
 * Creates a new learning category.
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
    const parsed = LearningCategoryCreateZ.parse(body)

    const existingName = await prisma.learningCategory.findUnique({ where: { name: parsed.name } })
    if (existingName) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: 'A category with this name already exists' } },
        { status: 409 },
      )
    }

    const existingSlug = await prisma.learningCategory.findUnique({ where: { slug: parsed.slug } })
    if (existingSlug) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: 'A category with this slug already exists' } },
        { status: 409 },
      )
    }

    const category = await prisma.learningCategory.create({
      data: {
        name: parsed.name,
        slug: parsed.slug,
        ordering: parsed.ordering,
        subsections: parsed.subsections,
        isActive: true,
      },
    })

    return NextResponse.json({ ok: true, category }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 },
      )
    }
    console.error('POST /api/editorial/settings/learning-categories error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
