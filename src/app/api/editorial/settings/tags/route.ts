import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { EditorialTagCreateZ, EditorialTagUpdateZ, EditorialTagDeleteZ } from '@/lib/schemas/editorial'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/editorial/settings/tags
 *
 * Returns all available tags.
 * Public endpoint (for dropdown population), but superuser-only for management.
 */
export async function GET() {
  try {
    const tags = await prisma.dailyDoseTag.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        createdBy: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ ok: true, tags })
  } catch (error) {
    console.error('GET /api/editorial/settings/tags error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}

/**
 * POST /api/editorial/settings/tags
 *
 * Creates a new tag.
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
    const parsed = EditorialTagCreateZ.parse(body)

    // Check if tag already exists
    const existing = await prisma.dailyDoseTag.findUnique({
      where: { name: parsed.name },
    })

    if (existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: 'Tag already exists' } },
        { status: 409 },
      )
    }

    const tag = await prisma.dailyDoseTag.create({
      data: {
        name: parsed.name,
        createdBy: user.id,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        createdBy: true,
      },
    })

    return NextResponse.json({ ok: true, tag }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 },
      )
    }
    console.error('POST /api/editorial/settings/tags error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}

/**
 * PUT /api/editorial/settings/tags
 *
 * Updates an existing tag name.
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
    const parsed = EditorialTagUpdateZ.parse(body)

    // Check if tag exists
    const existing = await prisma.dailyDoseTag.findUnique({
      where: { id: parsed.id },
    })

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Tag not found' } },
        { status: 404 },
      )
    }

    // Check if new name already exists (and is different from current)
    if (parsed.name !== existing.name) {
      const nameExists = await prisma.dailyDoseTag.findUnique({
        where: { name: parsed.name },
      })

      if (nameExists) {
        return NextResponse.json(
          { ok: false, error: { code: 'CONFLICT', message: 'Tag name already exists' } },
          { status: 409 },
        )
      }
    }

    const tag = await prisma.dailyDoseTag.update({
      where: { id: parsed.id },
      data: { name: parsed.name },
      select: {
        id: true,
        name: true,
        createdAt: true,
        createdBy: true,
      },
    })

    return NextResponse.json({ ok: true, tag })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 },
      )
    }
    console.error('PUT /api/editorial/settings/tags error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/editorial/settings/tags
 *
 * Deletes a tag. Prevents deletion if tag is in use by any cards.
 * Superuser-only.
 */
export async function DELETE(request: NextRequest) {
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
    const parsed = EditorialTagDeleteZ.parse(body)

    // Check if tag exists
    const tag = await prisma.dailyDoseTag.findUnique({
      where: { id: parsed.id },
    })

    if (!tag) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Tag not found' } },
        { status: 404 },
      )
    }

    // Check if tag is in use by any cards
    // Tags are stored as JSON arrays in DailyDoseCard.tags
    // We need to fetch cards and check manually since Prisma doesn't support JSON array contains directly
    const allCards = await prisma.dailyDoseCard.findMany({
      select: { tags: true },
      take: 1000, // Reasonable limit for checking tag usage
    })

    const tagInUse = allCards.some((card) => {
      if (!card.tags || !Array.isArray(card.tags)) return false
      return card.tags.includes(tag.name)
    })

    if (tagInUse) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'CONFLICT',
            message: 'Cannot delete tag: it is currently in use by one or more cards',
          },
        },
        { status: 409 },
      )
    }

    await prisma.dailyDoseTag.delete({
      where: { id: parsed.id },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 },
      )
    }
    console.error('DELETE /api/editorial/settings/tags error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
