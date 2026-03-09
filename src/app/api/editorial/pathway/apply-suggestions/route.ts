import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SuggestedAssignment {
  categoryId: string
  categoryName: string
  subsection?: string | null
}

/**
 * POST /api/editorial/pathway/apply-suggestions
 *
 * Applies generatedFrom.suggestedAssignments to learningAssignments for cards
 * that have no saved assignments but do have AI suggestions.
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

    const surgeryIdParam = request.nextUrl.searchParams.get('surgeryId')
    const surgeryId = resolveSurgeryIdForUser({ requestedId: surgeryIdParam ?? undefined, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const cards = await prisma.dailyDoseCard.findMany({
      where: {
        AND: [
          { OR: [{ surgeryId }, { surgeryId: null }] },
          { isActive: true },
          {
            OR: [
              { learningAssignments: null },
              { learningAssignments: { equals: [] } },
            ],
          },
        ],
      },
      select: {
        id: true,
        generatedFrom: true,
      },
    })

    // Filter to cards with non-empty suggestedAssignments
    const toUpdate = cards.filter((card) => {
      const gf = card.generatedFrom as { suggestedAssignments?: SuggestedAssignment[] } | null
      const suggestions = Array.isArray(gf?.suggestedAssignments) ? gf.suggestedAssignments : []
      return suggestions.length > 0
    })

    let updated = 0
    for (const card of toUpdate) {
      const gf = card.generatedFrom as { suggestedAssignments: SuggestedAssignment[] }
      const suggestions = gf.suggestedAssignments
      const learningAssignments = suggestions
        .filter((s) => s?.categoryId && s?.categoryName)
        .map((s) => ({
          categoryId: s.categoryId,
          categoryName: s.categoryName,
          subsection: s.subsection ?? null,
        }))
      if (learningAssignments.length > 0) {
        await prisma.dailyDoseCard.update({
          where: { id: card.id },
          data: { learningAssignments },
        })
        updated++
      }
    }

    return NextResponse.json({ ok: true, updated })
  } catch (error) {
    console.error('POST /api/editorial/pathway/apply-suggestions error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
