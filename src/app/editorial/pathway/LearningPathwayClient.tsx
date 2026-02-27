'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface SubsectionSummary {
  name: string
  totalCards: number
  publishedCards: number
}

interface CategorySummary {
  id: string
  name: string
  slug: string
  ordering: number
  totalCards: number
  publishedCards: number
  subsections: SubsectionSummary[]
}

interface PathwayData {
  pathway: CategorySummary[]
  unassignedCount: number
}

/**
 * Returns the completion colour class set for a category tile.
 * Coverage is based on subsections that have at least 1 card.
 * - Red   : no subsections covered
 * - Amber : some subsections covered
 * - Green : all subsections covered
 */
function getCoverageColour(cat: CategorySummary): {
  bg: string
  border: string
  text: string
  badge: string
  label: string
} {
  const totalSubs = cat.subsections.length
  const coveredSubs = cat.subsections.filter((s) => s.totalCards > 0).length

  if (totalSubs === 0 || coveredSubs === 0) {
    return {
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-900',
      badge: 'bg-red-200 text-red-800',
      label: 'Not started',
    }
  }
  if (coveredSubs < totalSubs) {
    return {
      bg: 'bg-amber-50',
      border: 'border-amber-300',
      text: 'text-amber-900',
      badge: 'bg-amber-200 text-amber-800',
      label: 'In progress',
    }
  }
  return {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-900',
    badge: 'bg-emerald-200 text-emerald-800',
    label: 'Complete',
  }
}

export default function LearningPathwayClient({ surgeryId }: { surgeryId: string }) {
  const [data, setData] = useState<PathwayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchPathway = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/editorial/pathway')
      const payload = await response.json().catch(() => ({ ok: false }))
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message || 'Failed to load learning pathway')
        return
      }
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPathway()
  }, [fetchPathway])

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-500">
        Loading learning pathway…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    )
  }

  const totalPublished = data?.pathway.reduce((sum, c) => sum + c.publishedCards, 0) ?? 0
  const totalCards = data?.pathway.reduce((sum, c) => sum + c.totalCards, 0) ?? 0
  const expandedCategory = data?.pathway.find((c) => c.id === expandedId) ?? null

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nhs-dark-blue">Learning Pathway</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data?.pathway.length ?? 0} active categories · {totalPublished} published cards · {totalCards} total cards assigned
          </p>
        </div>
        <Link
          href={`/editorial/settings?surgery=${surgeryId}`}
          className="rounded-md bg-nhs-blue px-4 py-1.5 text-xs font-semibold text-white hover:bg-nhs-dark-blue"
        >
          Manage categories
        </Link>
      </div>

      {/* No categories state */}
      {(!data?.pathway || data.pathway.length === 0) && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">
            No active learning categories found.
          </p>
          <Link
            href={`/editorial/settings?surgery=${surgeryId}`}
            className="mt-3 inline-block text-sm text-nhs-blue hover:underline"
          >
            Go to Editorial Settings to seed default categories →
          </Link>
        </div>
      )}

      {/* 4×3 category grid */}
      {data && data.pathway.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.pathway.map((cat) => {
            const colour = getCoverageColour(cat)
            const totalSubs = cat.subsections.length
            const coveredSubs = cat.subsections.filter((s) => s.totalCards > 0).length
            const isExpanded = expandedId === cat.id

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleExpanded(cat.id)}
                aria-expanded={isExpanded}
                className={[
                  'flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-xl border-2 px-4 py-5 text-center shadow-sm transition',
                  'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2',
                  colour.bg,
                  colour.border,
                  colour.text,
                  isExpanded ? 'ring-2 ring-nhs-blue ring-offset-2' : '',
                ].join(' ')}
              >
                <span className="text-base font-bold leading-snug">{cat.name}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${colour.badge}`}>
                  {colour.label}
                </span>
                <div className="flex flex-col items-center gap-0.5 text-xs opacity-80">
                  <span>{cat.totalCards} card{cat.totalCards !== 1 ? 's' : ''}</span>
                  <span>{coveredSubs}/{totalSubs} subsections covered</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Expanded detail panel */}
      {expandedCategory && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-nhs-dark-blue">{expandedCategory.name}</h2>
            <button
              type="button"
              onClick={() => setExpandedId(null)}
              className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:border-nhs-blue hover:text-nhs-blue"
            >
              Close
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {expandedCategory.subsections.length === 0 && (
              <p className="py-2 text-sm text-slate-500">No subsections defined for this category.</p>
            )}
            {expandedCategory.subsections.map((sub) => (
              <div key={sub.name} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      sub.totalCards > 0 ? 'bg-emerald-500' : 'bg-red-400'
                    }`}
                  />
                  {sub.name}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {sub.publishedCards > 0 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
                      {sub.publishedCards} published
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                    sub.totalCards > 0 ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {sub.totalCards} card{sub.totalCards !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unassigned cards notice */}
      {(data?.unassignedCount ?? 0) > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          <strong>{data!.unassignedCount}</strong> card{data!.unassignedCount !== 1 ? 's are' : ' is'} not assigned to any learning category.
          {' '}
          <Link
            href={`/editorial/library?surgery=${surgeryId}`}
            className="font-medium underline hover:no-underline"
          >
            Review in Library →
          </Link>
        </div>
      )}
    </div>
  )
}
