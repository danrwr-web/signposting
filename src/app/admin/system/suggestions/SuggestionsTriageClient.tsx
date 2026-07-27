'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import SimpleHeader from '@/components/SimpleHeader'
import AdminTable from '@/components/admin/AdminTable'
import AdminSearchBar from '@/components/admin/AdminSearchBar'
import { Badge } from '@/components/ui'
import type { SuggestionStatus, SuggestionType } from '@/lib/api-contracts'
import {
  SUGGESTION_STATUSES,
  SUGGESTION_STATUS_BADGE_COLORS,
  SUGGESTION_STATUS_LABELS,
  SUGGESTION_TYPES,
  SUGGESTION_TYPE_BADGE_COLORS,
  SUGGESTION_TYPE_LABELS,
  formatSuggestionDate,
} from '@/lib/suggestions'
import SuggestionDetailPanel from './SuggestionDetailPanel'
import type { TriageSuggestion } from './types'

interface SuggestionsTriageClientProps {
  suggestions: TriageSuggestion[]
  /** Preselects the type filter (e.g. from a ?type= link in notification emails). */
  initialTypeFilter?: SuggestionType
}

function FilterChip({
  label,
  active,
  onToggle,
}: {
  label: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-nhs-blue text-white border-nhs-blue'
          : 'bg-white text-nhs-grey border-gray-300 hover:border-nhs-blue'
      }`}
    >
      {label}
    </button>
  )
}

export default function SuggestionsTriageClient({
  suggestions,
  initialTypeFilter,
}: SuggestionsTriageClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<SuggestionType | 'all'>(initialTypeFilter ?? 'all')
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus | 'all'>('all')
  const [selected, setSelected] = useState<TriageSuggestion | null>(null)

  // Symptom-content suggestions are triaged by each practice's own admin team
  // (Admin dashboard → Suggestions), so they're hidden here — and excluded from
  // the counts — unless the Symptom content filter is selected.
  const scoped = useMemo(
    () =>
      suggestions.filter((s) =>
        typeFilter === 'SYMPTOM_CONTENT'
          ? s.type === 'SYMPTOM_CONTENT'
          : s.type !== 'SYMPTOM_CONTENT'
      ),
    [suggestions, typeFilter]
  )

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return scoped.filter((s) => {
      if (typeFilter !== 'all' && s.type !== typeFilter) return false
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (q) {
        const haystack = [s.title, s.text, s.symptom, s.userEmail, s.surgery?.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [scoped, searchQuery, typeFilter, statusFilter])

  const statusCounts = useMemo(() => {
    const counts: Record<SuggestionStatus, number> = {
      PENDING: 0,
      UNDER_REVIEW: 0,
      PLANNED: 0,
      DONE: 0,
      DECLINED: 0,
    }
    for (const s of scoped) counts[s.status] += 1
    return counts
  }, [scoped])

  // Keep the open detail panel in sync with server-refreshed data.
  const selectedCurrent = selected
    ? suggestions.find((s) => s.id === selected.id) ?? selected
    : null

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={[]} currentSurgeryId={undefined} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-nhs-dark-blue">Feedback &amp; suggestions</h1>
          <p className="text-nhs-grey mt-2">
            Feature requests, improvements, and bug reports from all surgeries. Open an item to set
            its status or respond to the submitter. Symptom-content suggestions are handled by each
            practice&apos;s own admin team — select the Symptom content filter to view them anyway.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
            <div className="text-xl font-bold text-gray-900">{scoped.length}</div>
            <p className="text-xs text-gray-600">Total</p>
          </div>
          {SUGGESTION_STATUSES.map((status) => (
            <div key={status} className="bg-white rounded-lg border border-gray-200 p-3 text-center">
              <div className="text-xl font-bold text-gray-900">{statusCounts[status]}</div>
              <p className="text-xs text-gray-600">{SUGGESTION_STATUS_LABELS[status]}</p>
            </div>
          ))}
        </div>

        {/* Search + filters */}
        <div className="space-y-3 mb-4">
          <AdminSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by title, text, submitter, or surgery…"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mr-1">Type</span>
            {SUGGESTION_TYPES.map((type) => (
              <FilterChip
                key={type}
                label={SUGGESTION_TYPE_LABELS[type]}
                active={typeFilter === type}
                onToggle={() => setTypeFilter(typeFilter === type ? 'all' : type)}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mr-1">Status</span>
            {SUGGESTION_STATUSES.map((status) => (
              <FilterChip
                key={status}
                label={SUGGESTION_STATUS_LABELS[status]}
                active={statusFilter === status}
                onToggle={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              />
            ))}
            <span className="ml-auto text-xs text-gray-500">
              Showing {filtered.length} of {scoped.length}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <AdminTable<TriageSuggestion>
            scrollContainerClassName="overflow-x-auto"
            cellPadding="px-4"
            columns={[
              {
                header: 'Type',
                key: 'type',
                render: (row) => (
                  <Badge color={SUGGESTION_TYPE_BADGE_COLORS[row.type]}>
                    {SUGGESTION_TYPE_LABELS[row.type]}
                  </Badge>
                ),
              },
              {
                header: 'Suggestion',
                key: 'title',
                className: 'whitespace-normal',
                render: (row) => (
                  <div className="max-w-md">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {row.title || row.symptom || 'Suggestion'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{row.text}</p>
                  </div>
                ),
              },
              {
                header: 'Surgery',
                key: 'surgery',
                render: (row) => (
                  <span className="text-sm text-gray-600">{row.surgery?.name || '—'}</span>
                ),
              },
              {
                header: 'Submitted by',
                key: 'submittedBy',
                render: (row) => (
                  <span className="text-sm text-gray-600">
                    {row.submittedBy?.name || row.submittedBy?.email || row.userEmail || 'Unknown'}
                  </span>
                ),
              },
              {
                header: 'Status',
                key: 'status',
                render: (row) => (
                  <Badge color={SUGGESTION_STATUS_BADGE_COLORS[row.status]} pill>
                    {SUGGESTION_STATUS_LABELS[row.status]}
                  </Badge>
                ),
              },
              {
                header: 'Submitted',
                key: 'createdAt',
                render: (row) => (
                  <span className="text-sm text-gray-500">{formatSuggestionDate(row.createdAt)}</span>
                ),
              },
            ]}
            rows={filtered}
            rowKey={(row) => row.id}
            onRowClick={(row) => setSelected(row)}
            emptyMessage="No suggestions match the current filters."
          />
        </div>
      </main>

      <SuggestionDetailPanel
        suggestion={selectedCurrent}
        onClose={() => setSelected(null)}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}
