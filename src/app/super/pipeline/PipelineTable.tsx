'use client'

import { useState, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import { Button, Badge, AlertBanner, ConfirmDialog } from '@/components/ui'
import type { BadgeColor } from '@/components/ui/Badge'
import PipelineDialog from './PipelineDialog'
import InlineDateCell from './InlineDateCell'
import { exportPipelineToExcel } from './pipelineExport'
import {
  PipelineEntry,
  PipelineStatus,
  STATUS_LABELS,
  STATUS_BADGE_COLOURS,
} from './types'
import { getTrialStatus, formatDaysRemaining, TrialStatus } from './trialStatus'

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

export default function PipelineTable({ entries, setEntries }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<PipelineEntry | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  // Summary calculations
  const summary = useMemo(() => {
    const total = entries.length
    const contracted = entries.filter((e) => e.status === 'Contracted')
    const inProgress = entries.filter(
      (e) => !['Contracted', 'Lost', 'OnHold'].includes(e.status)
    )
    const onFreeTrial = entries.filter((e) => getTrialStatus(e).onTrial)
    const contractedListSize = contracted.reduce((sum, e) => sum + (e.listSize ?? 0), 0)
    const contractedArr = contracted.reduce((sum, e) => sum + (e.annualValueGbp ?? e.estimatedFeeGbp ?? 0), 0)
    const pipelineArr = inProgress.reduce((sum, e) => sum + (e.annualValueGbp ?? e.estimatedFeeGbp ?? 0), 0)
    return { total, contracted: contracted.length, inProgress: inProgress.length, onFreeTrial: onFreeTrial.length, contractedListSize, contractedArr, pipelineArr }
  }, [entries])

  // Trial alerts: invoices now due, and trials ending within 60 days
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
        <p className="text-sm text-gray-600">{entries.length} practices</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => exportPipelineToExcel(entries)}>
            Export to Excel
          </Button>
          <Button onClick={openCreate}>Add Practice</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Practice Name', 'PCN', 'List Size', 'Est. Fee', 'Contact', 'Status', 'Contract Start', 'Trial Ends', 'Days', 'Invoice Generated', 'Invoice Paid', 'Notes', ''].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {entries.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-8 text-center text-sm text-gray-500">
                  No pipeline entries yet. Click &ldquo;Add Practice&rdquo; to get started.
                </td>
              </tr>
            )}
            {entries.map((entry) => {
              const days = daysSince(entry.dateEnquiry)
              const trial = getTrialStatus(entry)
              return (
                <tr
                  key={entry.id}
                  className={`cursor-pointer ${
                    trial.invoiceDue ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => openEdit(entry)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {entry.practiceName}
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
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {entry.contactName || '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-col items-start gap-1">
                      <Badge color={STATUS_BADGE_COLOURS[entry.status] as BadgeColor} size="sm">
                        {STATUS_LABELS[entry.status]}
                      </Badge>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDeleteId(entry.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
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
            ? This cannot be undone.
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
