import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import {
  computeUnitStatus,
  computeThemeRAG,
  computeSecurePercentage,
  recommendNextUnit,
  type UnitProgressData,
} from '@/lib/daily-dose/pathwayLogic'
import type { PathwayUnitLevel, PathwayUnitStatus } from '@/lib/daily-dose/constants'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ themeId: string }> }
) {
  try {
    const { themeId } = await context.params
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const surgeryId = resolveSurgeryIdForUser({
      requestedId: request.nextUrl.searchParams.get('surgeryId') ?? undefined,
      user,
    })
    if (!surgeryId) {
      return NextResponse.json({ error: 'Surgery access required' }, { status: 403 })
    }

    const theme = await prisma.dailyDoseTheme.findFirst({
      where: {
        id: themeId,
        isActive: true,
        OR: [{ surgeryId }, { surgeryId: null }],
      },
      include: {
        units: {
          where: { isActive: true },
          orderBy: [{ level: 'asc' }, { ordering: 'asc' }],
          include: {
            progress: {
              where: { userId: user.id, surgeryId },
            },
            _count: {
              select: { cards: true },
            },
          },
        },
      },
    })

    if (!theme) {
      return NextResponse.json({ error: 'Theme not found' }, { status: 404 })
    }

    const unitProgressData: UnitProgressData[] = theme.units.map((unit) => {
      const progress = unit.progress[0]
      const status: PathwayUnitStatus = progress
        ? (computeUnitStatus({
            sessionsCompleted: progress.sessionsCompleted,
            correctCount: progress.correctCount,
            totalQuestions: progress.totalQuestions,
          }) as PathwayUnitStatus)
        : 'NOT_STARTED'

      return {
        unitId: unit.id,
        level: unit.level as PathwayUnitLevel,
        ordering: unit.ordering,
        status,
        sessionsCompleted: progress?.sessionsCompleted ?? 0,
        correctCount: progress?.correctCount ?? 0,
        totalQuestions: progress?.totalQuestions ?? 0,
      }
    })

    const rag = computeThemeRAG(unitProgressData)
    const securePercentage = computeSecurePercentage(unitProgressData)
    const recommendedNextUnitId = recommendNextUnit(unitProgressData)

    const units = theme.units.map((unit) => {
      const progressItem = unitProgressData.find((u) => u.unitId === unit.id)!
      const accuracy =
        progressItem.totalQuestions > 0
          ? Math.round((progressItem.correctCount / progressItem.totalQuestions) * 100)
          : 0

      return {
        id: unit.id,
        title: unit.title,
        description: unit.description,
        level: unit.level as PathwayUnitLevel,
        ordering: unit.ordering,
        status: progressItem.status,
        accuracy,
        sessionsCompleted: progressItem.sessionsCompleted,
        cardCount: unit._count.cards,
        isRecommendedNext: unit.id === recommendedNextUnitId,
      }
    })

    return NextResponse.json({
      theme: {
        id: theme.id,
        name: theme.name,
        description: theme.description,
        rag,
        securePercentage,
      },
      units,
    })
  } catch (error) {
    console.error('GET /api/daily-dose/pathway/themes/[themeId] error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
