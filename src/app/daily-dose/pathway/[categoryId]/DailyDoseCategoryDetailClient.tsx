'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import PhoneFrame from '@/components/daily-dose/PhoneFrame'

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

function getSubsectionStatus(sub: SubsectionSummary): {
  dot: string
  label: string
} {
  if (sub.totalCards === 0) {
    return { dot: 'bg-red-400', label: 'No cards' }
  }
  if (sub.publishedCards === 0) {
    return { dot: 'bg-amber-400', label: 'Draft only' }
  }
  return { dot: 'bg-emerald-500', label: `${sub.publishedCards} published` }
}

function getCoverageColour(cat: CategorySummary): {
  bg: string
  border: string
  text: string
  dot: string
} {
  const totalSubs = cat.subsections.length
  const coveredSubs = cat.subsections.filter((s) => s.totalCards > 0).length
  if (totalSubs === 0 || coveredSubs === 0) {
    return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', dot: 'bg-red-400' }
  }
  if (coveredSubs < totalSubs) {
    return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', dot: 'bg-amber-400' }
  }
  return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', dot: 'bg-emerald-500' }
}

interface Props {
  surgeryId: string
  categoryId: string
  /** When true, the primary CTA starts a focused session filtered to this category. */
  focusMode?: boolean
}

export default function DailyDoseCategoryDetailClient({ surgeryId, categoryId, focusMode = false }: Props) {
  const [category, setCategory] = useState<CategorySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCategory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/editorial/pathway')
      const payload = await response.json().catch(() => ({ ok: false }))
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message || 'Failed to load pathway data')
        return
      }
      const data = payload as PathwayData
      const found = data.pathway.find((c) => c.id === categoryId) ?? null
      if (!found) {
        setError('Category not found')
        return
      }
      setCategory(found)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [categoryId])

  useEffect(() => {
    fetchCategory()
  }, [fetchCategory])

  const colour = category ? getCoverageColour(category) : null
  const coveredSubs = category ? category.subsections.filter((s) => s.totalCards > 0).length : 0
  const totalSubs = category ? category.subsections.length : 0

  // Back link respects focus mode
  const backHref = focusMode
    ? `/daily-dose/pathway?surgery=${surgeryId}&mode=focus`
    : `/daily-dose/pathway?surgery=${surgeryId}`

  // Primary session CTA: focused session when in focus mode, otherwise generic session
  const sessionHref = focusMode
    ? `/daily-dose/session?surgery=${surgeryId}&category=${categoryId}`
    : `/daily-dose/session?surgery=${surgeryId}`

  const sessionLabel = focusMode
    ? `Start a focused session`
    : 'Start a session'

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col">
        {/* Header bar */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Link
            href={backHref}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-nhs-blue"
            aria-label="Back to Learning Pathway"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="truncate text-base font-bold text-nhs-dark-blue">
            {loading ? 'Loading…' : (category?.name ?? 'Category')}
          </h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-500">Loading…</p>
            </div>
          )}

          {error && (
            <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && category && colour && (
            <>
              {/* Category summary banner */}
              <div className={`mx-4 mt-4 rounded-xl border px-4 py-3 ${colour.bg} ${colour.border}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-semibold ${colour.text}`}>{category.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {coveredSubs}/{totalSubs} subsections covered · {category.totalCards} cards
                    </p>
                  </div>
                  <span className={`inline-block h-3 w-3 rounded-full ${colour.dot}`} />
                </div>
              </div>

              {/* Focus mode hint */}
              {focusMode && (
                <div className="mx-4 mt-3 rounded-lg border border-nhs-blue/20 bg-nhs-light-blue/30 px-4 py-2.5">
                  <p className="text-xs text-nhs-dark-blue">
                    Your session will focus on cards from this category.
                  </p>
                </div>
              )}

              {/* Subsections list */}
              <div className="mt-4 px-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Topics in this category
                </p>
                <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {category.subsections.length === 0 && (
                    <p className="px-4 py-4 text-sm text-slate-500">No subsections defined.</p>
                  )}
                  {category.subsections.map((sub) => {
                    const status = getSubsectionStatus(sub)
                    return (
                      <div key={sub.name} className="flex items-center justify-between px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${status.dot}`} />
                          <span className="truncate text-sm text-slate-800">{sub.name}</span>
                        </div>
                        <div className="ml-3 shrink-0 text-right">
                          <span className="text-xs text-slate-500">
                            {sub.totalCards} card{sub.totalCards !== 1 ? 's' : ''}
                          </span>
                          {sub.publishedCards > 0 && (
                            <p className="text-[11px] text-emerald-600">{status.label}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Footer CTAs */}
              <div className="px-4 py-5">
                <Link
                  href={sessionHref}
                  className="block w-full rounded-xl bg-nhs-blue py-3 text-center text-sm font-semibold text-white hover:bg-nhs-dark-blue"
                >
                  {sessionLabel}
                </Link>
                <Link
                  href={backHref}
                  className="mt-2 block w-full rounded-xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Back to Pathway
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </PhoneFrame>
  )
}
