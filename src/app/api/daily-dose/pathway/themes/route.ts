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

export async function GET(request: NextRequest) {
  try {
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

    // Fetch themes with units and user progress
    const themes = await prisma.dailyDoseTheme.findMany({
      where: {
        isActive: true,
        OR: [{ surgeryId }, { surgeryId: null }],
      },
      orderBy: [{ ordering: 'asc' }, { name: 'asc' }],
      include: {
        units: {
          where: { isActive: true },
          orderBy: [{ level: 'asc' }, { ordering: 'asc' }],
          include: {
            progress: {
              where: { userId: user.id, surgeryId },
            },
          },
        },
      },
    })

    const result = themes.map((theme) => {
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
      const secureUnitCount = unitProgressData.filter((u) => u.status === 'SECURE').length
      const recommendedNextUnitId = recommendNextUnit(unitProgressData)

      return {
        id: theme.id,
        name: theme.name,
        description: theme.description,
        ordering: theme.ordering,
        rag,
        securePercentage,
        unitCount: unitProgressData.length,
        secureUnitCount,
        recommendedNextUnitId,
      }
    })

    return NextResponse.json({ themes: result })
  } catch (error) {
    console.error('GET /api/daily-dose/pathway/themes error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
