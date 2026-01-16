'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Modal from '@/components/appointments/Modal'
import { createAdminToolkitListRow, deleteAdminToolkitListRow, updateAdminToolkitListRow } from '../actions'

type ColumnFieldType = 'TEXT' | 'MULTILINE' | 'PHONE' | 'EMAIL' | 'URL'

type ListColumn = {
  id: string
  key: string
  label: string
  fieldType: string
  orderIndex: number
}

type ListRow = {
  id: string
  data: Record<string, string>
  orderIndex: number
}

interface AdminToolkitListClientProps {
  surgeryId: string
  itemId: string
  canEditThisItem: boolean
  columns: ListColumn[]
  rows: ListRow[]
}

function normaliseValue(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  return String(raw)
}

export default function AdminToolkitListClient({ surgeryId, itemId, canEditThisItem, columns, rows }: AdminToolkitListClientProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [editingRow, setEditingRow] = useState<ListRow | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const modalFirstFieldRef = useRef<HTMLInputElement>(null)

  const normalisedQuery = query.trim().toLowerCase()

  const filteredRows = useMemo(() => {
    if (!normalisedQuery) return rows
    return rows.filter((r) => {
      for (const c of columns) {
        const v = normaliseValue(r.data[c.key]).toLowerCase()
        if (v.includes(normalisedQuery)) return true
      }
      return false
    })
  }, [rows, columns, normalisedQuery])

  const handleModalClose = useCallback(() => {
    if (saving) return
    setEditingRow(null)
  }, [saving])

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-nhs-dark-blue">List</h2>
          <p className="mt-1 text-sm text-nhs-grey">Search, add, and update rows.</p>
        </div>
        {canEditThisItem ? (
          <button
            type="button"
            className="nhs-button"
            onClick={async () => {
              setSaving(true)
              try {
                const res = await createAdminToolkitListRow({ surgeryId, itemId })
                if (!res.ok) {
                  toast.error(res.error.message)
                  return
                }
                toast.success('Row added')
                // Open modal with an empty draft; the row exists already, saving will update it.
                const empty: Record<string, string> = {}
                for (const c of columns) empty[c.key] = ''
                setEditingRow({ id: res.data.id, orderIndex: 0, data: empty })
                setDraft(empty)
                router.refresh()
              } finally {
                setSaving(false)
              }
            }}
          >
            Add row
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
        <input
          ref={searchInputRef}
          className="w-full nhs-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this list…"
        />
      </div>

      {columns.length === 0 ? (
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <strong>No columns yet.</strong> Ask an Admin Toolkit writer to add columns in Admin Toolkit settings.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {columns.map((c) => (
                  <th key={c.id} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {c.label}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-500" colSpan={columns.length + 1}>
                    {normalisedQuery ? 'No rows match your search.' : 'No rows yet.'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.id}>
                    {columns.map((c) => (
                      <td key={c.id} className="px-4 py-3 text-sm text-gray-900 align-top whitespace-pre-wrap">
                        {r.data[c.key] || ''}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="nhs-button-secondary"
                          disabled={!canEditThisItem}
                          onClick={() => {
                            const nextDraft: Record<string, string> = {}
                            for (const c of columns) nextDraft[c.key] = r.data[c.key] || ''
                            setEditingRow(r)
                            setDraft(nextDraft)
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="nhs-button-secondary"
                          disabled={!canEditThisItem}
                          onClick={async () => {
                            const ok = confirm('Delete this row?')
                            if (!ok) return
                            const res = await deleteAdminToolkitListRow({ surgeryId, itemId, rowId: r.id })
                            if (!res.ok) {
                              toast.error(res.error.message)
                              return
                            }
                            toast.success('Row deleted')
                            router.refresh()
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingRow ? (
        <Modal
          title="Edit row"
          onClose={handleModalClose}
          initialFocusRef={modalFirstFieldRef}
        >
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!editingRow) return
              setSaving(true)
              try {
                const res = await updateAdminToolkitListRow({ surgeryId, itemId, rowId: editingRow.id, data: draft })
                if (!res.ok) {
                  toast.error(res.error.message)
                  return
                }
                toast.success('Row saved')
                setEditingRow(null)
                router.refresh()
              } finally {
                setSaving(false)
              }
            }}
          >
            {columns.map((c, idx) => {
              const fieldType = (c.fieldType as ColumnFieldType) || 'TEXT'
              const value = draft[c.key] ?? ''
              return (
                <div key={c.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{c.label}</label>
                  {fieldType === 'MULTILINE' ? (
                    <textarea
                      key={`textarea-${c.key}`}
                      className="w-full nhs-input min-h-[90px]"
                      value={value}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [c.key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      key={`input-${c.key}`}
                      ref={idx === 0 ? modalFirstFieldRef : undefined}
                      className="w-full nhs-input"
                      type={fieldType === 'PHONE' ? 'tel' : fieldType === 'EMAIL' ? 'email' : fieldType === 'URL' ? 'url' : 'text'}
                      value={value}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [c.key]: e.target.value }))}
                    />
                  )}
                </div>
              )
            })}

            <div className="flex justify-end gap-2">
              <button type="button" className="nhs-button-secondary" disabled={saving} onClick={() => setEditingRow(null)}>
                Cancel
              </button>
              <button type="submit" className="nhs-button" disabled={saving || !canEditThisItem}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}

