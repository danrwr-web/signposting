'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge, type BadgeColor } from '@/components/ui/Badge'
import { SkeletonCardGrid } from '@/components/ui/Skeleton'

type ThemeRAG = 'red' | 'amber' | 'green' | 'not_started'

type ThemeSummary = {
  id: string
  name: string
  description: string | null
  ordering: number
  rag: ThemeRAG
  securePercentage: number
  unitCount: number
  secureUnitCount: number
  recommendedNextUnitId: string | null
}

const ragConfig: Record<
  ThemeRAG,
  { badge: BadgeColor; border: string; label: string }
> = {
  red: { badge: 'nhs-red', border: 'border-l-4 border-l-red-600', label: 'Needs work' },
  amber: { badge: 'amber', border: 'border-l-4 border-l-amber-400', label: 'In progress' },
  green: { badge: 'nhs-green', border: 'border-l-4 border-l-green-600', label: 'Secure' },
  not_started: { badge: 'gray', border: 'border-l-4 border-l-gray-300', label: 'Not started' },
}

export default function PathwayThemeMapClient({ surgeryId }: { surgeryId: string }) {
  const [themes, setThemes] = useState<ThemeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetch(`/api/daily-dose/pathway/themes?surgeryId=${surgeryId}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          throw new Error(payload?.error || 'Unable to load pathway')
        }
        const payload = await res.json()
        if (!active) return
        setThemes(payload.themes)
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
  }, [surgeryId])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-gray-200 rounded animate-pulse" />
        </div>
        <SkeletonCardGrid
          count={6}
          gridCols="grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          showBadge
          lines={2}
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
          <h1 className="text-lg font-semibold text-red-700">Unable to load pathway</h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  if (themes.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-nhs-dark-blue mb-2">Learning Pathway</h1>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="28" y="20" width="52" height="68" rx="4" stroke="#D1D5DB" strokeWidth="3" fill="#F9FAFB" />
            <rect x="40" y="32" width="52" height="68" rx="4" stroke="#E5E7EB" strokeWidth="3" fill="white" />
            <line x1="52" y1="48" x2="80" y2="48" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
            <line x1="52" y1="56" x2="76" y2="56" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
            <line x1="52" y1="64" x2="72" y2="64" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <h2 className="mt-4 text-lg font-semibold text-gray-600">No themes available yet</h2>
          <p className="mt-1 text-sm text-gray-500">
            Learning pathway themes will appear here once configured.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-nhs-dark-blue">Learning Pathway</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your journey through the safety curriculum
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {themes.map((theme) => {
          const config = ragConfig[theme.rag]
          const isNotStarted = theme.rag === 'not_started'

          return (
            <Link
              key={theme.id}
              href={`/s/${surgeryId}/daily-dose/pathway/${theme.id}`}
              className="block"
            >
              <Card
                elevation="raised"
                hoverable
                padding="none"
                className={`${config.border} ${isNotStarted ? 'opacity-60' : ''}`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <Badge color={config.badge} size="sm">
                      {config.label}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {theme.secureUnitCount}/{theme.unitCount} units
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-nhs-dark-blue mb-1">
                    {theme.name}
                  </h3>
                  {theme.description && (
                    <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                      {theme.description}
                    </p>
                  )}
                  {/* Progress bar */}
                  <div className="mt-auto">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>{theme.securePercentage}% secure</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-200">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
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
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
