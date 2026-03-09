import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface StoredAssignment {
  categoryId: string
  categoryName: string
  subsection?: string | null
}

/**
 * GET /api/editorial/pathway
 *
 * Returns the full learning pathway structure with per-subsection card counts.
 * Optional ?role=ADMIN|GP|NURSE filters counts to that role only.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 },
    )
  }

  const roleParam = request.nextUrl.searchParams.get('role')
  const targetRole =
    roleParam === 'GP' || roleParam === 'NURSE' || roleParam === 'ADMIN' ? roleParam : null

  try {
    const cardWhere: { isActive: boolean; targetRole?: string } = { isActive: true }
    if (targetRole) cardWhere.targetRole = targetRole

    const [categories, cards] = await Promise.all([
      prisma.learningCategory.findMany({
        where: { isActive: true },
        orderBy: [{ ordering: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          ordering: true,
          subsections: true,
        },
      }),
      prisma.dailyDoseCard.findMany({
        where: cardWhere,
        select: {
          id: true,
          status: true,
          learningAssignments: true,
        },
      }),
    ])

    // Build lookup: categoryId -> subsection -> Set of cardIds (total + published)
    type SubMap = Map<string, { total: Set<string>; published: Set<string> }>
    const catMap = new Map<string, SubMap>()

    for (const card of cards) {
      const assignments = Array.isArray(card.learningAssignments)
        ? (card.learningAssignments as StoredAssignment[])
        : []

      for (const assignment of assignments) {
        if (!assignment?.categoryId) continue

        if (!catMap.has(assignment.categoryId)) {
          catMap.set(assignment.categoryId, new Map())
        }
        const subMap = catMap.get(assignment.categoryId)!
        const sub = assignment.subsection ?? ''

        if (!subMap.has(sub)) {
          subMap.set(sub, { total: new Set(), published: new Set() })
        }
        const entry = subMap.get(sub)!
        entry.total.add(card.id)
        if (card.status === 'PUBLISHED') {
          entry.published.add(card.id)
        }
      }
    }

    // Tally unassigned cards (no learningAssignments or empty array)
    const unassignedCount = cards.filter((c) => {
      const a = Array.isArray(c.learningAssignments) ? c.learningAssignments : []
      return a.length === 0
    }).length

    const pathway = categories.map((cat) => {
      const subsections = Array.isArray(cat.subsections) ? (cat.subsections as string[]) : []
      const subMap = catMap.get(cat.id)

      // Unique card IDs across all subsections for this category
      const allCardIds = new Set<string>()
      const publishedCardIds = new Set<string>()

      const subsectionCounts = subsections.map((sub) => {
        const entry = subMap?.get(sub)
        const totalCards = entry?.total.size ?? 0
        const publishedCards = entry?.published.size ?? 0
        entry?.total.forEach((id) => allCardIds.add(id))
        entry?.published.forEach((id) => publishedCardIds.add(id))
        return { name: sub, totalCards, publishedCards }
      })

      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        ordering: cat.ordering,
        totalCards: allCardIds.size,
        publishedCards: publishedCardIds.size,
        subsections: subsectionCounts,
      }
    })

    return NextResponse.json({ ok: true, pathway, unassignedCount })
  } catch (error) {
    console.error('GET /api/editorial/pathway error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
