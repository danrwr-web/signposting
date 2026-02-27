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

/**
 * Returns Red / Amber / Green colour classes based on subsection coverage.
 */
function getCoverageStyle(cat: CategorySummary): {
  bg: string
  border: string
  text: string
  dot: string
  label: string
} {
  const totalSubs = cat.subsections.length
  const coveredSubs = cat.subsections.filter((s) => s.totalCards > 0).length

  if (totalSubs === 0 || coveredSubs === 0) {
    return {
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-900',
      dot: 'bg-red-400',
      label: 'Not started',
    }
  }
  if (coveredSubs < totalSubs) {
    return {
      bg: 'bg-amber-50',
      border: 'border-amber-300',
      text: 'text-amber-900',
      dot: 'bg-amber-400',
      label: 'In progress',
    }
  }
  return {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-900',
    dot: 'bg-emerald-500',
    label: 'Complete',
  }
}

export default function DailyDosePathwayClient({ surgeryId }: { surgeryId: string }) {
  const [data, setData] = useState<PathwayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col">
        {/* Header bar */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Link
            href={`/daily-dose?surgery=${surgeryId}`}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-nhs-blue"
            aria-label="Back to Daily Dose"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-base font-bold text-nhs-dark-blue">Learning Pathway</h1>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-500">Loading…</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              <p className="mb-4 text-xs text-slate-500">
                {data.pathway.length} categories · tap a topic to explore
              </p>

              {/* 2-column grid inside the phone frame */}
              <div className="grid grid-cols-2 gap-2.5">
                {data.pathway.map((cat) => {
                  const style = getCoverageStyle(cat)
                  const totalSubs = cat.subsections.length
                  const coveredSubs = cat.subsections.filter((s) => s.totalCards > 0).length

                  return (
                    <Link
                      key={cat.id}
                      href={`/daily-dose/pathway/${cat.id}?surgery=${surgeryId}`}
                      className={[
                        'flex min-h-[110px] flex-col items-center justify-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition',
                        'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-1',
                        style.bg,
                        style.border,
                        style.text,
                      ].join(' ')}
                    >
                      <span className="text-[13px] font-bold leading-tight">{cat.name}</span>
                      <span className="flex items-center gap-1 text-[11px] opacity-80">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {coveredSubs}/{totalSubs} topics
                      </span>
                    </Link>
                  )
                })}
              </div>

              {data.pathway.length === 0 && (
                <div className="mt-8 text-center text-sm text-slate-500">
                  No learning categories have been set up yet.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PhoneFrame>
  )
}
