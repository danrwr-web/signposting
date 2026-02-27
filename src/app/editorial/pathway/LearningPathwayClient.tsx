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

export default function LearningPathwayClient({ surgeryId }: { surgeryId: string }) {
  const [data, setData] = useState<PathwayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

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
      // Expand all by default
      setExpandedIds(new Set(payload.pathway.map((c: CategorySummary) => c.id)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPathway()
  }, [fetchPathway])

  const toggleCategory = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const collapseAll = () => setExpandedIds(new Set())
  const expandAll = () => setExpandedIds(new Set(data?.pathway.map((c) => c.id) ?? []))

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-nhs-blue hover:text-nhs-blue"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-nhs-blue hover:text-nhs-blue"
          >
            Collapse all
          </button>
          <Link
            href={`/editorial/settings?surgery=${surgeryId}`}
            className="rounded-md bg-nhs-blue px-4 py-1.5 text-xs font-semibold text-white hover:bg-nhs-dark-blue"
          >
            Manage categories
          </Link>
        </div>
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

      {/* Category list */}
      <div className="space-y-3">
        {data?.pathway.map((cat) => {
          const isExpanded = expandedIds.has(cat.id)
          const hasCards = cat.totalCards > 0
          return (
            <div
              key={cat.id}
              className="rounded-lg border border-slate-200 bg-white overflow-hidden"
            >
              {/* Category header */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm select-none">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                  <span className="font-semibold text-nhs-dark-blue">{cat.name}</span>
                  <span className="text-xs text-slate-400 font-mono">{cat.slug}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {cat.publishedCards > 0 && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      {cat.publishedCards} published
                    </span>
                  )}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    hasCards ? 'bg-nhs-light-blue text-nhs-blue' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {cat.totalCards} card{cat.totalCards !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-slate-400">
                    {cat.subsections.length} subsection{cat.subsections.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </button>

              {/* Subsections */}
              {isExpanded && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                  {cat.subsections.map((sub) => (
                    <div
                      key={sub.name}
                      className="flex items-center justify-between px-8 py-2.5"
                    >
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="text-slate-300 text-xs">└</span>
                        {sub.name}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {sub.publishedCards > 0 && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
                            {sub.publishedCards} published
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                          sub.totalCards > 0
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-slate-50 text-slate-400'
                        }`}>
                          {sub.totalCards} card{sub.totalCards !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

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
