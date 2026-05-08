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
        OR: [{ surgeryId }, { surgeryId: null }],
        isActive: true,
      },
      select: {
        id: true,
        learningAssignments: true,
        generatedFrom: true,
      },
    })

    const categories = await prisma.learningCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, subsections: true },
    })
    const categoriesById = new Map(categories.map((c) => [c.id, c]))

    // Filter to cards with no saved assignments but with suggestedAssignments
    const toUpdate = cards.filter((card) => {
      const assignments = Array.isArray(card.learningAssignments) ? card.learningAssignments : []
      if (assignments.length > 0) return false
      const gf = card.generatedFrom as { suggestedAssignments?: SuggestedAssignment[] } | null
      const suggestions = Array.isArray(gf?.suggestedAssignments) ? gf.suggestedAssignments : []
      return suggestions.length > 0
    })

    let updated = 0
    for (const card of toUpdate) {
      const gf = card.generatedFrom as { suggestedAssignments: SuggestedAssignment[] }
      const suggestions = gf.suggestedAssignments
      const learningAssignments = suggestions
        .filter((s) => s?.categoryId && categoriesById.has(s.categoryId))
        .map((s) => {
          const category = categoriesById.get(s.categoryId)!
          const subsection = s.subsection?.trim()
          const validSubsections = Array.isArray(category.subsections)
            ? (category.subsections as string[])
            : []
          const normalisedSubsection =
            subsection && validSubsections.includes(subsection) ? subsection : null
          return {
            categoryId: s.categoryId,
            categoryName: category.name,
            subsection: normalisedSubsection,
          }
        })
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
