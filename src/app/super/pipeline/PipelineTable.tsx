'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { Button, Badge, AlertBanner, ConfirmDialog, EmptyState } from '@/components/ui'
import type { BadgeColor } from '@/components/ui/Badge'
import AdminSearchBar from '@/components/admin/AdminSearchBar'
import PipelineDialog from './PipelineDialog'
import InlineDateCell from './InlineDateCell'
import { exportPipelineToExcel } from './pipelineExport'
import {
  PipelineEntry,
  PipelineStatus,
  PIPELINE_STATUSES,
  STATUS_LABELS,
  STATUS_BADGE_COLOURS,
} from './types'
import { getTrialStatus, formatDaysRemaining, TrialStatus } from './trialStatus'
import {
  filterEntries,
  sortEntries,
  PipelineSort,
  PipelineSortKey,
} from './pipelineTableUtils'

interface Props {
  entries: PipelineEntry[]
  setEntries: React.Dispatch<React.SetStateAction<PipelineEntry[]>>
}

function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null
  const created = new Date(isoDate)
  const now = new Date()
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const COLUMNS: { label: string; sortKey?: PipelineSortKey }[] = [
  { label: 'Practice Name', sortKey: 'name' },
  { label: 'PCN' },
  { label: 'List Size', sortKey: 'listSize' },
  { label: 'Est. Fee', sortKey: 'fee' },
  { label: 'Contact' },
  { label: 'Status', sortKey: 'status' },
  { label: 'Contract Start', sortKey: 'contractStart' },
  { label: 'Trial Ends', sortKey: 'trialEnds' },
  { label: 'Days', sortKey: 'days' },
  { label: 'Invoice Generated' },
  { label: 'Invoice Paid' },
  { label: 'Notes' },
  { label: '' },
]

export default function PipelineTable({ entries, setEntries }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<PipelineEntry | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilters, setStatusFilters] = useState<PipelineStatus[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [sort, setSort] = useState<PipelineSort | null>(null)

  function openCreate() {
    setEditingEntry(null)
    setDialogOpen(true)
  }

  function openEdit(entry: PipelineEntry) {
    setEditingEntry(entry)
    setDialogOpen(true)
  }

  function handleSaved(saved: PipelineEntry) {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = saved
        return copy
      }
      return [saved, ...prev]
    })
  }

  async function handleDelete() {
    if (!pendingDeleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/super/pipeline/${pendingDeleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete')
        return
      }
      setEntries((prev) => prev.filter((e) => e.id !== pendingDeleteId))
      toast.success('Entry deleted')
      setPendingDeleteId(null)
    } catch {
      toast.error('An error occurred')
    } finally {
      setDeleting(false)
    }
  }

  async function handleArchiveToggle(entry: PipelineEntry) {
    setArchivingId(entry.id)
    const archiving = !entry.archivedAt
    try {
      const res = await fetch(`/api/super/pipeline/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivedAt: archiving ? new Date().toISOString() : null }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || `Failed to ${archiving ? 'archive' : 'unarchive'}`)
        return
      }
      const updated = await res.json()
      handleSaved(updated)
      toast.success(archiving ? `${entry.practiceName} archived` : `${entry.practiceName} restored`)
    } catch {
      toast.error('An error occurred')
    } finally {
      setArchivingId(null)
    }
  }

  function toggleStatusFilter(status: PipelineStatus) {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
  }

  function toggleSort(key: PipelineSortKey) {
    setSort((prev) => (prev?.key === key ? { key, desc: !prev.desc } : { key, desc: false }))
  }

  function clearFilters() {
    setSearch('')
    setStatusFilters([])
    setShowArchived(false)
  }

  const activeEntries = useMemo(() => entries.filter((e) => !e.archivedAt), [entries])
  const archivedCount = entries.length - activeEntries.length

  const visibleEntries = useMemo(
    () =>
      sortEntries(
        filterEntries(entries, { statuses: statusFilters, showArchived, query: search }),
        sort
      ),
    [entries, statusFilters, showArchived, search, sort]
  )

  const hasActiveFilters = search.trim() !== '' || statusFilters.length > 0 || showArchived

  // Summary calculations (archived entries excluded)
  const summary = useMemo(() => {
    const total = activeEntries.length
    const contracted = activeEntries.filter((e) => e.status === 'Contracted')
    const inProgress = activeEntries.filter(
      (e) => !['Contracted', 'Lost', 'OnHold'].includes(e.status)
    )
    const onFreeTrial = activeEntries.filter((e) => getTrialStatus(e).onTrial)
    const contractedListSize = contracted.reduce((sum, e) => sum + (e.listSize ?? 0), 0)
    const contractedArr = contracted.reduce((sum, e) => sum + (e.annualValueGbp ?? e.estimatedFeeGbp ?? 0), 0)
    const pipelineArr = inProgress.reduce((sum, e) => sum + (e.annualValueGbp ?? e.estimatedFeeGbp ?? 0), 0)
    return { total, contracted: contracted.length, inProgress: inProgress.length, onFreeTrial: onFreeTrial.length, contractedListSize, contractedArr, pipelineArr }
  }, [activeEntries])

  // Trial alerts: invoices now due, and trials ending within 60 days (archived excluded via getTrialStatus)
  const trialAlerts = useMemo(() => {
    const withStatus = entries
      .map((e) => ({ entry: e, trial: getTrialStatus(e) }))
      .filter(({ trial }) => trial.onTrial && trial.daysRemaining !== null)
      .sort((a, b) => a.trial.daysRemaining! - b.trial.daysRemaining!)
    return {
      invoiceDue: withStatus.filter(({ trial }) => trial.invoiceDue),
      endingSoon: withStatus.filter(
        ({ trial }) =>
          !trial.invoiceDue && trial.daysRemaining! >= 0 && trial.daysRemaining! <= 60
      ),
    }
  }, [entries])

  return (
    <>
      {/* Trial alerts */}
      {trialAlerts.invoiceDue.length > 0 && (
        <AlertBanner variant="error" className="mb-4">
          <span className="font-medium">Free trial ended — invoice due:</span>
          <ul className="mt-1 ml-4 list-disc text-sm">
            {trialAlerts.invoiceDue.map(({ entry, trial }) => (
              <li key={entry.id}>
                {entry.practiceName} — trial {trial.daysRemaining! < 0 ? 'ended' : 'ends'}{' '}
                {formatDate(entry.trialEndDate)} ({formatDaysRemaining(trial.daysRemaining!)}) and no
                invoice has been generated
              </li>
            ))}
          </ul>
        </AlertBanner>
      )}
      {trialAlerts.endingSoon.length > 0 && (
        <AlertBanner variant="warning" className="mb-4">
          <span className="font-medium">Free trials ending soon:</span>
          <ul className="mt-1 ml-4 list-disc text-sm">
            {trialAlerts.endingSoon.map(({ entry, trial }) => (
              <li key={entry.id}>
                {entry.practiceName} — trial ends {formatDate(entry.trialEndDate)} (
                {formatDaysRemaining(trial.daysRemaining!)})
              </li>
            ))}
          </ul>
        </AlertBanner>
      )}

      {/* Actions bar */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-600">
          {hasActiveFilters
            ? `Showing ${visibleEntries.length} of ${entries.length} practices`
            : `${activeEntries.length} practices${archivedCount > 0 ? ` (${archivedCount} archived)` : ''}`}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => exportPipelineToExcel(visibleEntries)}>
            Export to Excel
          </Button>
          <Button onClick={openCreate}>Add Practice</Button>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <AdminSearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by practice, PCN, town or contact…"
          debounceMs={0}
        />
        <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center gap-2">
          {PIPELINE_STATUSES.map((status) => (
            <FilterChip
              key={status}
              label={STATUS_LABELS[status]}
              active={statusFilters.includes(status)}
              onToggle={() => toggleStatusFilter(status)}
            />
          ))}
          <span className="mx-1 h-5 border-l border-gray-300" aria-hidden="true" />
          <FilterChip
            label={`Show archived (${archivedCount})`}
            active={showArchived}
            onToggle={() => setShowArchived((v) => !v)}
          />
          {hasActiveFilters && (
            <span className="ml-auto">
              <Button variant="link" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            </span>
          )}
        </div>
        <div className="overflow-x-auto rounded-b-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {COLUMNS.map(({ label, sortKey }) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    aria-sort={
                      sortKey && sort?.key === sortKey
                        ? sort.desc
                          ? 'descending'
                          : 'ascending'
                        : undefined
                    }
                  >
                    {sortKey ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(sortKey)}
                        className="uppercase tracking-wider font-medium hover:text-gray-700"
                      >
                        {label}
                        {sort?.key === sortKey ? (sort.desc ? ' ↓' : ' ↑') : ''}
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {visibleEntries.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-8">
                    {entries.length === 0 ? (
                      <EmptyState
                        title="No pipeline entries yet"
                        description="Add your first practice to start tracking the sales pipeline."
                        illustration="clipboard"
                        action={{ label: 'Add Practice', onClick: openCreate }}
                      />
                    ) : (
                      <EmptyState
                        title="No matching practices"
                        description="Try a different search term or clear the filters."
                        illustration="search"
                        action={{ label: 'Clear filters', onClick: clearFilters, variant: 'secondary' }}
                      />
                    )}
                  </td>
                </tr>
              )}
              {visibleEntries.map((entry) => {
                const days = daysSince(entry.dateEnquiry)
                const trial = getTrialStatus(entry)
                const archived = !!entry.archivedAt
                return (
                  <tr
                    key={entry.id}
                    className={`cursor-pointer ${
                      archived
                        ? 'opacity-60 hover:bg-gray-50'
                        : trial.invoiceDue
                          ? 'bg-amber-50 hover:bg-amber-100'
                          : 'hover:bg-gray-50'
                    }`}
                    onClick={() => openEdit(entry)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {entry.practiceName}
                        {entry.linkedSurgery && (
                          <Link
                            href={`/s/${entry.linkedSurgery.id}/dashboard`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-nhs-blue hover:text-nhs-dark-blue"
                            title={`Open ${entry.linkedSurgery.name} dashboard`}
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                            <span className="sr-only">Open surgery dashboard</span>
                          </Link>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {entry.pcnName || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {entry.listSize?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatCurrency(entry.estimatedFeeGbp)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {entry.contactName ? (
                        <div className="flex flex-col">
                          {entry.contactEmail ? (
                            <a
                              href={`mailto:${entry.contactEmail}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-nhs-blue hover:underline"
                              title={entry.contactEmail}
                            >
                              {entry.contactName}
                            </a>
                          ) : (
                            <span className="text-gray-600">{entry.contactName}</span>
                          )}
                          {entry.contactRole && (
                            <span className="text-xs text-gray-400">{entry.contactRole}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <Badge color={STATUS_BADGE_COLOURS[entry.status] as BadgeColor} size="sm">
                          {STATUS_LABELS[entry.status]}
                        </Badge>
                        {archived && (
                          <Badge color="gray" size="sm">
                            Archived
                          </Badge>
                        )}
                        {trial.onTrial && (
                          <Badge color="purple" size="sm">
                            Free Trial
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(entry.dateContractStart)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <TrialEndsCell entry={entry} trial={trial} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {days !== null ? days : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <InlineDateCell
                        entryId={entry.id}
                        field="invoiceGeneratedAt"
                        value={entry.invoiceGeneratedAt}
                        onUpdated={handleSaved}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <InlineDateCell
                        entryId={entry.id}
                        field="invoicePaidAt"
                        value={entry.invoicePaidAt}
                        onUpdated={handleSaved}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                      {entry.notes || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchiveToggle(entry)}
                          loading={archivingId === entry.id}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          {archived ? 'Unarchive' : 'Archive'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingDeleteId(entry.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary strip */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <SummaryCard label="Total Practices" value={summary.total.toString()} />
        <SummaryCard label="Contracted" value={summary.contracted.toString()} />
        <SummaryCard label="In Progress" value={summary.inProgress.toString()} />
        <SummaryCard label="On Free Trial" value={summary.onFreeTrial.toString()} />
        <SummaryCard label="Contracted List Size" value={summary.contractedListSize.toLocaleString()} />
        <SummaryCard label="Contracted ARR" value={formatCurrency(summary.contractedArr)} />
        <SummaryCard label="Pipeline ARR" value={formatCurrency(summary.pipelineArr)} />
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete pipeline entry"
        message={
          <>
            Are you sure you want to delete{' '}
            <span className="font-medium">
              {entries.find((e) => e.id === pendingDeleteId)?.practiceName ?? 'this entry'}
            </span>
            ? This cannot be undone. If the practice has just gone quiet, consider archiving it
            instead.
          </>
        }
        confirmLabel="Delete"
        loading={deleting}
      />

      {/* Dialog */}
      <PipelineDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        entry={editingEntry}
        onSaved={handleSaved}
      />
    </>
  )
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

function TrialEndsCell({ entry, trial }: { entry: PipelineEntry; trial: TrialStatus }) {
  if (!trial.onTrial) {
    return <span className="text-sm text-gray-600">—</span>
  }
  if (trial.daysRemaining === null) {
    return (
      <Badge color="amber" size="sm">
        No end date
      </Badge>
    )
  }
  const pillColor: BadgeColor =
    trial.urgency === 'expired' || trial.urgency === 'critical'
      ? 'red'
      : trial.urgency === 'warning'
        ? 'amber'
        : 'gray'
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-sm text-gray-600">{formatDate(entry.trialEndDate)}</span>
      <div className="flex items-center gap-1">
        <Badge color={pillColor} size="sm">
          {formatDaysRemaining(trial.daysRemaining)}
        </Badge>
        {trial.invoiceDue && (
          <Badge color="nhs-red" size="sm">
            Invoice due
          </Badge>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-lg font-semibold text-nhs-dark-blue">{value}</p>
    </div>
  )
}
