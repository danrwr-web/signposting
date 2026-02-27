import 'server-only'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/editorial/pathway
 *
 * Returns the full learning pathway structure with per-subsection card counts.
 * Available to any authenticated editorial user.
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 },
    )
  }

  try {
    const categories = await prisma.learningCategory.findMany({
      where: { isActive: true },
      orderBy: [{ ordering: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        ordering: true,
        subsections: true,
        cards: {
          where: { isActive: true },
          select: {
            id: true,
            learningSubsection: true,
            status: true,
            title: true,
          },
        },
      },
    })

    // Count unassigned published/approved cards
    const unassignedCount = await prisma.dailyDoseCard.count({
      where: {
        isActive: true,
        learningCategoryId: null,
        status: { in: ['PUBLISHED', 'APPROVED', 'DRAFT'] },
      },
    })

    const pathway = categories.map((cat) => {
      const subsections = Array.isArray(cat.subsections) ? (cat.subsections as string[]) : []
      const subsectionCounts = subsections.map((sub) => ({
        name: sub,
        totalCards: cat.cards.filter((c) => c.learningSubsection === sub).length,
        publishedCards: cat.cards.filter(
          (c) => c.learningSubsection === sub && c.status === 'PUBLISHED',
        ).length,
      }))
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        ordering: cat.ordering,
        totalCards: cat.cards.length,
        publishedCards: cat.cards.filter((c) => c.status === 'PUBLISHED').length,
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
