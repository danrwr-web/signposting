'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { PipelineEntry } from './types'

interface Props {
  entryId: string
  field: 'invoiceGeneratedAt' | 'invoicePaidAt'
  value: string | null
  onUpdated: (entry: PipelineEntry) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function InlineDateCell({ entryId, field, value, onUpdated }: Props) {
  const [saving, setSaving] = useState(false)

  async function patch(newValue: string | null) {
    setSaving(true)
    try {
      const res = await fetch(`/api/super/pipeline/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newValue }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to update')
        return
      }
      const updated = await res.json()
      onUpdated(updated)
    } catch {
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    if (v) patch(v)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    patch(null)
  }

  if (!value) {
    return (
      <input
        type="date"
        onChange={handleChange}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={saving}
        className="text-xs px-2 py-1 border border-gray-200 rounded bg-white text-gray-500 focus:border-nhs-blue focus:ring-1 focus:ring-nhs-blue focus:outline-none disabled:opacity-50"
        aria-label="Pick date"
      />
    )
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-gray-700">
      <span>{formatDate(value)}</span>
      <button
        type="button"
        onClick={handleClear}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={saving}
        aria-label="Clear date"
        className="text-gray-400 hover:text-red-600 disabled:opacity-50 rounded w-4 h-4 flex items-center justify-center leading-none text-xs"
        title="Clear date"
      >
        &times;
      </button>
    </div>
  )
}
