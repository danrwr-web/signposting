'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Surgery {
  id: string
  name: string
}

interface RecentChange {
  id: string
  title: string
  categoryId: string | null
  categoryName: string | null
  changeType: 'new' | 'updated'
  changedAt: string
}

interface HandbookWhatsChangedClientProps {
  surgery: Surgery
  changes: RecentChange[]
  windowDays: number
}

type FilterType = 'all' | 'new' | 'updated'

export default function HandbookWhatsChangedClient({
  surgery,
  changes,
  windowDays,
}: HandbookWhatsChangedClientProps) {
  const [filter, setFilter] = useState<FilterType>('all')

  const filteredChanges = changes.filter((change) => {
    if (filter === 'all') return true
    return change.changeType === filter
  })

  const newCount = changes.filter((c) => c.changeType === 'new').length
  const updatedCount = changes.filter((c) => c.changeType === 'updated').length

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const handbookHref = `/s/${surgery.id}/admin-toolkit`

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 min-h-screen">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href={handbookHref}
          className="text-sm text-nhs-blue hover:text-nhs-dark-blue hover:underline inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Practice Handbook
        </Link>
      </div>

      {/* Page header */}
      <h1 className="text-2xl font-bold text-gray-900 mb-2">What&apos;s changed</h1>
      <p className="text-sm text-gray-600 mb-6">
        Showing changes from the last {windowDays} days
      </p>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-nhs-blue text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          aria-pressed={filter === 'all'}
        >
          All ({changes.length})
        </button>
        <button
          onClick={() => setFilter('new')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'new'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          aria-pressed={filter === 'new'}
        >
          New ({newCount})
        </button>
        <button
          onClick={() => setFilter('updated')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filter === 'updated'
              ? 'bg-amber-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          aria-pressed={filter === 'updated'}
        >
          Updated ({updatedCount})
        </button>
      </div>

      {/* Changes list */}
      {filteredChanges.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-gray-600">
            {filter === 'all'
              ? `No recent changes in the last ${windowDays} days.`
              : `No ${filter} pages in the last ${windowDays} days.`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
          {filteredChanges.map((change) => (
            <Link
              key={change.id}
              href={`/s/${surgery.id}/admin-toolkit/${change.id}`}
              className="block px-4 py-4 hover:bg-gray-50 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-medium text-gray-900 group-hover:text-nhs-blue transition-colors truncate">
                      {change.title}
                    </h3>
                    {/* Change type badge */}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        change.changeType === 'new'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {change.changeType === 'new' ? 'New' : 'Updated'}
                    </span>
                  </div>
                  {change.categoryName && (
                    <p className="text-sm text-gray-500">{change.categoryName}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <span className="text-xs text-gray-400">{formatDate(change.changedAt)}</span>
                  <svg
                    className="w-4 h-4 text-gray-400 group-hover:text-nhs-blue transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Summary footer */}
      {changes.length > 0 && (
        <div className="mt-6 text-center text-sm text-gray-500">
          {newCount > 0 && updatedCount > 0 && (
            <p>
              {newCount} new page{newCount !== 1 ? 's' : ''} and {updatedCount} update
              {updatedCount !== 1 ? 's' : ''} in the last {windowDays} days
            </p>
          )}
          {newCount > 0 && updatedCount === 0 && (
            <p>
              {newCount} new page{newCount !== 1 ? 's' : ''} in the last {windowDays} days
            </p>
          )}
          {newCount === 0 && updatedCount > 0 && (
            <p>
              {updatedCount} page{updatedCount !== 1 ? 's' : ''} updated in the last {windowDays}{' '}
              days
            </p>
          )}
        </div>
      )}
    </main>
  )
}
