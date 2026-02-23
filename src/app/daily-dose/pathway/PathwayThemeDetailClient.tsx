'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge, type BadgeColor } from '@/components/ui/Badge'
import { SkeletonCardGrid } from '@/components/ui/Skeleton'
import type { PathwayUnitLevel, PathwayUnitStatus } from '@/lib/daily-dose/constants'

type ThemeRAG = 'red' | 'amber' | 'green' | 'not_started'

type ThemeDetail = {
  id: string
  name: string
  description: string | null
  rag: ThemeRAG
  securePercentage: number
}

type UnitDetail = {
  id: string
  title: string
  description: string | null
  level: PathwayUnitLevel
  ordering: number
  status: PathwayUnitStatus
  accuracy: number
  sessionsCompleted: number
  cardCount: number
  isRecommendedNext: boolean
}

const ragBadgeConfig: Record<ThemeRAG, { color: BadgeColor; label: string }> = {
  red: { color: 'nhs-red', label: 'Needs work' },
  amber: { color: 'amber', label: 'In progress' },
  green: { color: 'nhs-green', label: 'Secure' },
  not_started: { color: 'gray', label: 'Not started' },
}

const statusBadgeConfig: Record<PathwayUnitStatus, { color: BadgeColor; label: string }> = {
  NOT_STARTED: { color: 'gray', label: 'Not started' },
  IN_PROGRESS: { color: 'amber', label: 'In progress' },
  SECURE: { color: 'nhs-green', label: 'Secure' },
}

const levelLabels: Record<PathwayUnitLevel, string> = {
  INTRO: 'Introduction',
  CORE: 'Core',
  STRETCH: 'Stretch',
}

const levelDescriptions: Record<PathwayUnitLevel, string> = {
  INTRO: 'Foundational knowledge to get started',
  CORE: 'Essential skills and understanding',
  STRETCH: 'Advanced topics for deeper mastery',
}

export default function PathwayThemeDetailClient({
  surgeryId,
  themeId,
}: {
  surgeryId: string
  themeId: string
}) {
  const [theme, setTheme] = useState<ThemeDetail | null>(null)
  const [units, setUnits] = useState<UnitDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetch(`/api/daily-dose/pathway/themes/${themeId}?surgeryId=${surgeryId}`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          throw new Error(payload?.error || 'Unable to load theme')
        }
        const payload = await res.json()
        if (!active) return
        setTheme(payload.theme)
        setUnits(payload.units)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Something went wrong')
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [surgeryId, themeId])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-96 bg-gray-200 rounded animate-pulse mb-8" />
        <SkeletonCardGrid
          count={5}
          gridCols="grid-cols-1"
          showBadge
          lines={1}
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
          <h1 className="text-lg font-semibold text-red-700">Unable to load theme</h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  if (!theme) return null

  const ragConfig = ragBadgeConfig[theme.rag]

  // Group units by level
  const levels: PathwayUnitLevel[] = ['INTRO', 'CORE', 'STRETCH']
  const unitsByLevel = levels
    .map((level) => ({
      level,
      units: units.filter((u) => u.level === level),
    }))
    .filter((group) => group.units.length > 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href={`/s/${surgeryId}/daily-dose/pathway`}
        className="inline-flex items-center text-sm text-nhs-blue hover:text-nhs-dark-blue mb-4"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Pathway
      </Link>

      {/* Theme header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-nhs-dark-blue">{theme.name}</h1>
          <Badge color={ragConfig.color} size="md">
            {ragConfig.label}
          </Badge>
        </div>
        {theme.description && (
          <p className="text-sm text-slate-600 mb-4">{theme.description}</p>
        )}
        {/* Progress bar */}
        <div className="max-w-md">
          <div className="flex items-center justify-between text-sm text-slate-600 mb-1">
            <span>{theme.securePercentage}% secure</span>
            <span>
              {units.filter((u) => u.status === 'SECURE').length}/{units.length} units
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className={`h-2 rounded-full transition-all ${
                theme.rag === 'green'
                  ? 'bg-nhs-green'
                  : theme.rag === 'amber'
                    ? 'bg-amber-400'
                    : theme.rag === 'red'
                      ? 'bg-red-500'
                      : 'bg-gray-300'
              }`}
              style={{ width: `${theme.securePercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Units grouped by level */}
      <div className="space-y-8">
        {unitsByLevel.map(({ level, units: levelUnits }) => (
          <section key={level}>
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-nhs-dark-blue">
                {levelLabels[level]}
              </h2>
              <p className="text-xs text-slate-500">{levelDescriptions[level]}</p>
            </div>
            <div className="space-y-3">
              {levelUnits.map((unit) => {
                const statusConfig = statusBadgeConfig[unit.status]
                return (
                  <Card
                    key={unit.id}
                    elevation="flat"
                    padding="md"
                    className={unit.isRecommendedNext ? 'ring-2 ring-nhs-blue ring-offset-1' : ''}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-nhs-dark-blue truncate">
                            {unit.title}
                          </h3>
                          {unit.isRecommendedNext && (
                            <Badge color="nhs-blue" size="sm">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        {unit.description && (
                          <p className="text-xs text-slate-500 truncate">{unit.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {unit.status !== 'NOT_STARTED' && (
                          <span className="text-xs text-slate-500 whitespace-nowrap">
                            {unit.accuracy}% accuracy
                          </span>
                        )}
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {unit.sessionsCompleted} {unit.sessionsCompleted === 1 ? 'session' : 'sessions'}
                        </span>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {unit.cardCount} {unit.cardCount === 1 ? 'card' : 'cards'}
                        </span>
                        <Badge color={statusConfig.color} size="sm">
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
