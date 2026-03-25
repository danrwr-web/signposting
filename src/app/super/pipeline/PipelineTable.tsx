'use client'

import { useState, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import { Button, Badge, AlertBanner } from '@/components/ui'
import type { BadgeColor } from '@/components/ui/Badge'
import PipelineDialog from './PipelineDialog'
import { exportPipelineToExcel } from './pipelineExport'
import {
  PipelineEntry,
  PipelineStatus,
  STATUS_LABELS,
  STATUS_BADGE_COLOURS,
} from './types'

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

  async function handleDelete(id: string) {
    if (!confirm('Delete this pipeline entry?')) return
    try {
      const res = await fetch(`/api/super/pipeline/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete')
        return
      }
      setEntries((prev) => prev.filter((e) => e.id !== id))
      toast.success('Entry deleted')
    } catch {
      toast.error('An error occurred')
    }
  }

  // Summary calculations
  const summary = useMemo(() => {
    const total = entries.length
    const contracted = entries.filter((e) => e.status === 'Contracted')
    const inProgress = entries.filter(
      (e) => !['Contracted', 'Lost', 'OnHold'].includes(e.status)
    )
    const contractedListSize = contracted.reduce((sum, e) => sum + (e.listSize ?? 0), 0)
    const contractedArr = contracted.reduce((sum, e) => sum + (e.annualValueGbp ?? e.estimatedFeeGbp ?? 0), 0)
    const pipelineArr = inProgress.reduce((sum, e) => sum + (e.annualValueGbp ?? e.estimatedFeeGbp ?? 0), 0)
    return { total, contracted: contracted.length, inProgress: inProgress.length, contractedListSize, contractedArr, pipelineArr }
  }, [entries])

  // Renewals alert: contracted entries with trialEndDate within 60 days
  const renewalAlerts = useMemo(() => {
    const now = new Date()
    const cutoff = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
    return entries
      .filter(
        (e) =>
          e.status === 'Contracted' &&
          e.trialEndDate &&
          new Date(e.trialEndDate) >= now &&
          new Date(e.trialEndDate) <= cutoff
      )
      .sort((a, b) => new Date(a.trialEndDate!).getTime() - new Date(b.trialEndDate!).getTime())
  }, [entries])

  return (
    <>
      {/* Renewals alert */}
      {renewalAlerts.length > 0 && (
        <AlertBanner variant="warning" className="mb-4">
          <span className="font-medium">Upcoming trial renewals:</span>
          <ul className="mt-1 ml-4 list-disc text-sm">
            {renewalAlerts.map((e) => (
              <li key={e.id}>
                {e.practiceName} — trial ends{' '}
                {new Date(e.trialEndDate!).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
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
              {['Practice Name', 'PCN', 'List Size', 'Est. Fee', 'Contact', 'Status', 'Contract Start', 'Days', 'Notes', ''].map(
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
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500">
                  No pipeline entries yet. Click &ldquo;Add Practice&rdquo; to get started.
                </td>
              </tr>
            )}
            {entries.map((entry) => {
              const days = daysSince(entry.dateEnquiry)
              return (
                <tr
                  key={entry.id}
                  className="hover:bg-gray-50 cursor-pointer"
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
                    <Badge color={STATUS_BADGE_COLOURS[entry.status] as BadgeColor} size="sm">
                      {STATUS_LABELS[entry.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {formatDate(entry.dateContractStart)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {days !== null ? days : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                    {entry.notes || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(entry.id)}
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
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Total Practices" value={summary.total.toString()} />
        <SummaryCard label="Contracted" value={summary.contracted.toString()} />
        <SummaryCard label="In Progress" value={summary.inProgress.toString()} />
        <SummaryCard label="Contracted List Size" value={summary.contractedListSize.toLocaleString()} />
        <SummaryCard label="Contracted ARR" value={formatCurrency(summary.contractedArr)} />
        <SummaryCard label="Pipeline ARR" value={formatCurrency(summary.pipelineArr)} />
      </div>

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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-lg font-semibold text-nhs-dark-blue">{value}</p>
    </div>
  )
}
