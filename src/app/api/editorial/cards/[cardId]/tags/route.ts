import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { EditorialCardTagsUpdateZ } from '@/lib/schemas/editorial'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ cardId: string }>
}

const CardIdZ = z.string().min(1, 'Card ID is required')

/**
 * PUT /api/editorial/cards/[cardId]/tags
 *
 * Updates tags for a specific card.
 * Validates that all tags exist in the available tags list.
 * Requires admin access for the surgery.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 },
      )
    }

    const { cardId } = await params
    const cardIdParsed = CardIdZ.parse(cardId)
    const body = await request.json()
    const parsed = EditorialCardTagsUpdateZ.parse(body)

    const surgeryIdParam = request.nextUrl.searchParams.get('surgeryId') ?? parsed.surgeryId
    const surgeryId = resolveSurgeryIdForUser({ requestedId: surgeryIdParam, user })

    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 },
      )
    }

    // Verify card exists and belongs to surgery
    const card = await prisma.dailyDoseCard.findFirst({
      where: { id: cardIdParsed, surgeryId },
    })

    if (!card) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Card not found' } },
        { status: 404 },
      )
    }

    // Validate that all tags exist in available tags
    if (parsed.tags.length > 0) {
      const availableTags = await prisma.dailyDoseTag.findMany({
        select: { name: true },
      })
      const availableTagNames = new Set(availableTags.map((t) => t.name))

      const invalidTags = parsed.tags.filter((tag) => !availableTagNames.has(tag))
      if (invalidTags.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: 'INVALID_INPUT',
              message: `Invalid tags: ${invalidTags.join(', ')}. These tags do not exist in the available tags list.`,
            },
          },
          { status: 400 },
        )
      }
    }

    // Update card tags
    const updated = await prisma.dailyDoseCard.update({
      where: { id: card.id },
      data: {
        tags: parsed.tags,
      },
      select: {
        id: true,
        tags: true,
      },
    })

    return NextResponse.json({ ok: true, card: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid input',
            details: error.issues,
          },
        },
        { status: 400 },
      )
    }
    console.error('PUT /api/editorial/cards/[cardId]/tags error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
