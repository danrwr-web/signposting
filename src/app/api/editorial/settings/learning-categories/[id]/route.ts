import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { LearningCategoryUpdateZ } from '@/lib/schemas/editorial'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PUT /api/editorial/settings/learning-categories/[id]
 *
 * Updates an existing learning category.
 * Superuser-only.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const { id } = await params
    const body = await request.json()
    const parsed = LearningCategoryUpdateZ.parse(body)

    const existing = await prisma.learningCategory.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Category not found' } },
        { status: 404 },
      )
    }

    // Check name uniqueness if changing name
    if (parsed.name && parsed.name !== existing.name) {
      const nameConflict = await prisma.learningCategory.findUnique({ where: { name: parsed.name } })
      if (nameConflict) {
        return NextResponse.json(
          { ok: false, error: { code: 'CONFLICT', message: 'A category with this name already exists' } },
          { status: 409 },
        )
      }
    }

    const updated = await prisma.learningCategory.update({
      where: { id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.ordering !== undefined ? { ordering: parsed.ordering } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
        ...(parsed.subsections !== undefined ? { subsections: parsed.subsections } : {}),
      },
    })

    return NextResponse.json({ ok: true, category: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 },
      )
    }
    console.error('PUT /api/editorial/settings/learning-categories/[id] error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/editorial/settings/learning-categories/[id]
 *
 * Soft-deletes (deactivates) a learning category.
 * Cards assigned to this category keep their assignment but the category
 * is hidden from the pathway view and dropdowns.
 * Superuser-only.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
    const { id } = await params

    const existing = await prisma.learningCategory.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Category not found' } },
        { status: 404 },
      )
    }

    await prisma.learningCategory.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/editorial/settings/learning-categories/[id] error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
