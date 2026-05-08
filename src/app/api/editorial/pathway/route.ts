import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { resolveSurgeryIdForUser } from '@/lib/daily-dose/access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface StoredAssignment {
  categoryId: string
  categoryName: string
  subsection?: string | null
}

type MasteryState = 'NOT_STARTED' | 'IN_PROGRESS' | 'SECURE'
type UnitLevel = 'INTRO' | 'CORE' | 'STRETCH'
type SubsectionSummary = {
  name: string
  totalCards: number
  publishedCards: number
  masteryState: MasteryState
  accuracyPct: number
  attemptedQuestions: number
  correctQuestions: number
  unitLevel: UnitLevel
}

function getUnitPriority(level: UnitLevel): number {
  if (level === 'INTRO') return 0
  if (level === 'CORE') return 1
  return 2
}

function pickRecommendedNext(subsections: SubsectionSummary[]): SubsectionSummary | null {
  if (subsections.length === 0) return null

  const intro = subsections.filter((s) => s.unitLevel === 'INTRO')
  const core = subsections.filter((s) => s.unitLevel === 'CORE')
  const stretch = subsections.filter((s) => s.unitLevel === 'STRETCH')

  // 1) Incomplete intro unit exists -> next intro in sequence.
  const incompleteIntro = intro.find((s) => s.masteryState !== 'SECURE')
  if (incompleteIntro) return incompleteIntro

  // 2) All intro secure -> weakest core unit (lowest accuracy).
  if (intro.length > 0 && core.length > 0) {
    return [...core].sort((a, b) => a.accuracyPct - b.accuracyPct)[0]
  }

  // 3) All core secure -> first incomplete stretch unit.
  const allCoreSecure = core.length > 0 && core.every((s) => s.masteryState === 'SECURE')
  if (allCoreSecure && stretch.length > 0) {
    const firstIncompleteStretch = stretch.find((s) => s.masteryState !== 'SECURE')
    if (firstIncompleteStretch) return firstIncompleteStretch
  }

  // 4) All units secure -> maintenance lowest accuracy unit.
  return [...subsections].sort((a, b) => a.accuracyPct - b.accuracyPct)[0]
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
  const surgeryId = resolveSurgeryIdForUser({
    requestedId: request.nextUrl.searchParams.get('surgeryId') ?? undefined,
    user,
  })
  if (!surgeryId) {
    return NextResponse.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Surgery access required' } },
      { status: 403 },
    )
  }

  try {
    const cardWhere: { isActive: boolean; targetRole?: string } = { isActive: true }
    if (targetRole) cardWhere.targetRole = targetRole

    const [categories, cards, progressRows] = await Promise.all([
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
          unitLevel: true,
        },
      }),
      prisma.userCategoryProgress.findMany({
        where: {
          userId: user.id,
          surgeryId,
        },
        select: {
          categoryId: true,
          subsection: true,
          masteryState: true,
          accuracyPct: true,
          unitLevel: true,
          attemptedQuestions: true,
          correctQuestions: true,
        },
      }),
    ])

    // Build lookup: categoryId -> subsection -> Set of cardIds (total + published)
    type SubMap = Map<string, { total: Set<string>; published: Set<string> }>
    const catMap = new Map<string, SubMap>()
    const subsectionUnitLevelMap = new Map<string, UnitLevel>()

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

        const subsectionKey = `${assignment.categoryId}::${sub}`
        const existingLevel = subsectionUnitLevelMap.get(subsectionKey)
        const incomingLevel = (card.unitLevel ?? 'CORE') as UnitLevel
        if (!existingLevel || getUnitPriority(incomingLevel) < getUnitPriority(existingLevel)) {
          subsectionUnitLevelMap.set(subsectionKey, incomingLevel)
        }
      }
    }

    // Tally unassigned cards (no learningAssignments or empty array)
    const unassignedCount = cards.filter((c) => {
      const a = Array.isArray(c.learningAssignments) ? c.learningAssignments : []
      return a.length === 0
    }).length

    const progressMap = new Map(
      progressRows.map((row) => [`${row.categoryId}::${row.subsection}`, row])
    )

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
        const progress = progressMap.get(`${cat.id}::${sub}`)
        const masteryState = (progress?.masteryState ?? 'NOT_STARTED') as MasteryState
        entry?.total.forEach((id) => allCardIds.add(id))
        entry?.published.forEach((id) => publishedCardIds.add(id))
        const unitLevel = progress?.unitLevel
          ? (progress.unitLevel as UnitLevel)
          : subsectionUnitLevelMap.get(`${cat.id}::${sub}`) ?? 'CORE'

        return {
          name: sub,
          totalCards,
          publishedCards,
          masteryState,
          accuracyPct: progress?.accuracyPct ?? 0,
          attemptedQuestions: progress?.attemptedQuestions ?? 0,
          correctQuestions: progress?.correctQuestions ?? 0,
          unitLevel,
        }
      })

      const totalSubsections = subsectionCounts.length
      const secureSubsections = subsectionCounts.filter((s) => s.masteryState === 'SECURE').length
      const startedSubsections = subsectionCounts.filter((s) => s.masteryState !== 'NOT_STARTED').length
      const securePercent = totalSubsections > 0 ? (secureSubsections / totalSubsections) * 100 : 0
      const masteryState: MasteryState =
        totalSubsections === 0 || startedSubsections === 0
          ? 'NOT_STARTED'
          : securePercent >= 80
            ? 'SECURE'
            : 'IN_PROGRESS'

      const recommendedNext = pickRecommendedNext(subsectionCounts)

      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        ordering: cat.ordering,
        totalCards: allCardIds.size,
        publishedCards: publishedCardIds.size,
        masteryState,
        secureSubsections,
        totalSubsections,
        securePercent,
        recommendedNext: recommendedNext
          ? {
              subsection: recommendedNext.name,
              unitLevel: recommendedNext.unitLevel,
              masteryState: recommendedNext.masteryState,
              accuracyPct: recommendedNext.accuracyPct,
            }
          : null,
        subsections: subsectionCounts,
      }
    })
    const categoryRecommendation = pathway
      .map((cat) => ({
        categoryId: cat.id,
        categoryName: cat.name,
        ordering: cat.ordering,
        recommendedNext: cat.recommendedNext,
      }))
      .filter((item) => item.recommendedNext !== null)
      .sort((a, b) => a.ordering - b.ordering)[0]

    return NextResponse.json({
      ok: true,
      pathway,
      unassignedCount,
      surgeryId,
      recommendedNext: categoryRecommendation
        ? {
            categoryId: categoryRecommendation.categoryId,
            categoryName: categoryRecommendation.categoryName,
            ...categoryRecommendation.recommendedNext,
          }
        : null,
    })
  } catch (error) {
    console.error('GET /api/editorial/pathway error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
