'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Modal from '@/components/appointments/Modal'

type Card = {
  id: string
  batchId: string
  title: string
  status: 'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED'
  riskLevel: 'LOW' | 'MED' | 'HIGH'
  needsSourcing: boolean
  targetRole: 'ADMIN' | 'GP' | 'NURSE'
  tags: string[]
  reviewByDate: string | null
  createdAt: string
  clinicianApproved: boolean
  clinicianApprovedBy?: { id: string; name: string | null; email: string } | null
  clinicianApprovedAt?: string | null
}

function isPublishedOrHighRisk(card: Card): boolean {
  return card.status === 'PUBLISHED' || card.riskLevel === 'HIGH'
}

interface EditorialLibraryClientProps {
  surgeryId: string
  userName: string
  /** When true, show delete (single + bulk) actions. Same gating as other editorial actions (SUPERUSER or ADMIN for surgery). */
  canAdmin: boolean
}

const statusStyles: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  ARCHIVED: 'bg-gray-200 text-gray-600',
}

const riskStyles: Record<string, string> = {
  LOW: 'bg-emerald-100 text-emerald-800',
  MED: 'bg-amber-100 text-amber-800',
  HIGH: 'bg-red-100 text-red-700',
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Admin',
  GP: 'GP',
  NURSE: 'Nurse',
}

export default function EditorialLibraryClient({ surgeryId, userName, canAdmin }: EditorialLibraryClientProps) {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<
    null | { type: 'single'; card: Card } | { type: 'bulk'; count: number }
  >(null)
  const [typeDeleteValue, setTypeDeleteValue] = useState('')

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [riskFilter, setRiskFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'createdAt' | 'reviewByDate' | 'title'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const loadCards = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ surgeryId })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (roleFilter !== 'all') params.set('role', roleFilter)
      if (riskFilter !== 'all') params.set('risk', riskFilter)
      if (searchQuery) params.set('search', searchQuery)
      params.set('sortBy', sortBy)
      params.set('sortOrder', sortOrder)

      const response = await fetch(`/api/editorial/library?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Unable to load cards')
      }
      setCards(payload.cards || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [surgeryId, statusFilter, roleFilter, riskFilter, searchQuery, sortBy, sortOrder])

  useEffect(() => {
    loadCards()
  }, [loadCards])

  const handleAction = async (cardId: string, action: 'approve' | 'publish' | 'archive') => {
    setActionLoading(cardId)
    setError(null)
    try {
      const response = await fetch(`/api/editorial/cards/${cardId}/${action}?surgeryId=${surgeryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surgeryId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error?.message || `Unable to ${action} card`)
      }
      await loadCards()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteSingle = async (cardId: string) => {
    setActionLoading(cardId)
    setError(null)
    try {
      const response = await fetch(`/api/editorial/cards/${cardId}?surgeryId=${surgeryId}`, {
        method: 'DELETE',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Failed to delete card')
      }
      toast.success('Card deleted')
      await loadCards()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete card'
      setError(msg)
      toast.error(msg)
    } finally {
      setActionLoading(null)
      setDeleteConfirm(null)
      setTypeDeleteValue('')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setBulkDeleteLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/editorial/cards/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardIds: Array.from(selectedIds), surgeryId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Failed to delete cards')
      }
      const deletedCount = payload?.deletedCount ?? 0
      const requested = selectedIds.size
      if (deletedCount < requested) {
        toast.error(`Deleted ${deletedCount} of ${requested} cards. Some could not be deleted. You can try again.`)
        await loadCards()
      } else {
        toast.success(`Deleted ${deletedCount} card${deletedCount !== 1 ? 's' : ''}`)
        setSelectedIds(new Set())
        await loadCards()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete cards'
      setError(msg)
      toast.error(msg)
    } finally {
      setBulkDeleteLoading(false)
      setDeleteConfirm(null)
      setTypeDeleteValue('')
    }
  }

  const onRequestDeleteSingle = (card: Card) => {
    if (isPublishedOrHighRisk(card)) {
      setDeleteConfirm({ type: 'single', card })
      setTypeDeleteValue('')
    } else if (typeof window !== 'undefined' && window.confirm('Delete this card permanently? This cannot be undone.')) {
      void handleDeleteSingle(card.id)
    }
  }

  const onRequestBulkDelete = () => {
    const selectedCards = filteredCards.filter((c) => selectedIds.has(c.id))
    const anyHighRisk = selectedCards.some(isPublishedOrHighRisk)
    if (anyHighRisk) {
      setDeleteConfirm({ type: 'bulk', count: selectedIds.size })
      setTypeDeleteValue('')
    } else if (typeof window !== 'undefined' && window.confirm(`Delete ${selectedIds.size} card${selectedIds.size !== 1 ? 's' : ''} permanently? This cannot be undone.`)) {
      void handleBulkDelete()
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllOnPage = () => {
    setSelectedIds(new Set(filteredCards.map((c) => c.id)))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const filteredCards = cards

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {process.env.NODE_ENV !== 'production' && (
        <div
          className="rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900"
          role="status"
          aria-live="polite"
        >
          LIBRARY UI VERSION: delete-enabled
        </div>
      )}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-nhs-dark-blue">Card Library</h1>
            <p className="mt-1 text-sm text-slate-600">
              Browse, edit, and manage Daily Dose learning cards.
            </p>
          </div>
          <Link
            href={`/editorial?surgery=${surgeryId}`}
            className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue"
          >
            + Generate new cards
          </Link>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="search" className="text-sm text-slate-600">Search:</label>
            <input
              id="search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Card title..."
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="status" className="text-sm text-slate-600">Status:</label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
            >
              <option value="all">All</option>
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="role" className="text-sm text-slate-600">Role:</label>
            <select
              id="role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
            >
              <option value="all">All</option>
              <option value="ADMIN">Admin</option>
              <option value="GP">GP</option>
              <option value="NURSE">Nurse</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="risk" className="text-sm text-slate-600">Risk:</label>
            <select
              id="risk"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
            >
              <option value="all">All</option>
              <option value="LOW">Low</option>
              <option value="MED">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-sm text-slate-600">Sort:</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
            >
              <option value="createdAt">Created</option>
              <option value="reviewByDate">Review date</option>
              <option value="title">Title</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="rounded-md border border-slate-200 px-2 py-1.5 text-sm hover:bg-slate-50"
              aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Bulk actions bar (only for SUPERUSER / ADMIN) */}
      {canAdmin && !loading && filteredCards.length > 0 && selectedIds.size > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-700">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={selectAllOnPage}
            className="text-sm text-nhs-blue hover:underline"
          >
            Select all on page
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-sm text-slate-600 hover:underline"
          >
            Clear selection
          </button>
          <button
            type="button"
            onClick={onRequestBulkDelete}
            disabled={bulkDeleteLoading}
            className="text-sm font-medium text-red-700 hover:text-red-800 disabled:opacity-50"
          >
            {bulkDeleteLoading ? 'Deleting…' : `Delete selected (${selectedIds.size})`}
          </button>
        </div>
      )}

      {/* Cards Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-slate-600">Loading cards…</div>
        ) : filteredCards.length === 0 ? (
          <div className="p-6 text-center text-slate-600">
            No cards found. <Link href={`/editorial?surgery=${surgeryId}`} className="text-nhs-blue hover:underline">Generate some cards</Link> to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {canAdmin && (
                    <th className="px-4 py-3 text-left w-10" scope="col">
                      <label className="sr-only">Select</label>
                      <input
                        type="checkbox"
                        checked={filteredCards.length > 0 && selectedIds.size === filteredCards.length}
                        onChange={(e) => {
                          if (e.target.checked) selectAllOnPage()
                          else clearSelection()
                        }}
                        aria-label="Select all on page"
                        className="rounded border-slate-300"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Title</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Risk</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Review By</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Created</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCards.map((card) => {
                  const canApprove = card.status === 'DRAFT'
                  const canPublish = card.status === 'APPROVED' || (card.status === 'DRAFT' && card.riskLevel !== 'HIGH')
                  const canArchive = card.status !== 'ARCHIVED'
                  const needsClinicianApproval = card.riskLevel === 'HIGH' && !card.clinicianApproved
                  const isDeleting = actionLoading === card.id

                  return (
                    <tr key={card.id} className="hover:bg-slate-50">
                      {canAdmin && (
                        <td className="px-4 py-3">
                          <label className="sr-only">Select card {card.title}</label>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(card.id)}
                            onChange={() => toggleSelection(card.id)}
                            aria-label={`Select ${card.title}`}
                            className="rounded border-slate-300"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <Link
                          href={`/editorial/batches/${card.batchId}?surgery=${surgeryId}&card=${card.id}`}
                          className="font-medium text-nhs-blue hover:underline"
                        >
                          {card.title}
                        </Link>
                        {card.needsSourcing && (
                          <span className="ml-2 text-xs text-amber-600">Needs sourcing</span>
                        )}
                        {card.clinicianApproved && card.clinicianApprovedBy && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            ✓ Approved by {card.clinicianApprovedBy.name || card.clinicianApprovedBy.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{roleLabels[card.targetRole]}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${riskStyles[card.riskLevel]}`}>
                          {card.riskLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[card.status]}`}>
                          {card.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(card.reviewByDate)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(card.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/editorial/batches/${card.batchId}?surgery=${surgeryId}&card=${card.id}`}
                            className="text-xs text-nhs-blue hover:underline"
                          >
                            Edit
                          </Link>
                          {canApprove && (
                            <button
                              type="button"
                              onClick={() => handleAction(card.id, 'approve')}
                              disabled={actionLoading === card.id}
                              className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                              title={needsClinicianApproval ? 'Will record clinician approval' : undefined}
                            >
                              {actionLoading === card.id ? '…' : 'Approve'}
                            </button>
                          )}
                          {canPublish && !needsClinicianApproval && (
                            <button
                              type="button"
                              onClick={() => handleAction(card.id, 'publish')}
                              disabled={actionLoading === card.id}
                              className="text-xs text-emerald-600 hover:underline disabled:opacity-50"
                            >
                              {actionLoading === card.id ? '…' : 'Publish'}
                            </button>
                          )}
                          {canArchive && (
                            <button
                              type="button"
                              onClick={() => handleAction(card.id, 'archive')}
                              disabled={actionLoading === card.id}
                              className="text-xs text-slate-500 hover:underline disabled:opacity-50"
                            >
                              {actionLoading === card.id ? '…' : 'Archive'}
                            </button>
                          )}
                          {canAdmin && (
                            <button
                              type="button"
                              onClick={() => onRequestDeleteSingle(card)}
                              disabled={isDeleting}
                              className="text-xs text-red-700 hover:underline disabled:opacity-50 font-medium"
                              title="Delete card permanently"
                            >
                              {isDeleting ? '…' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation modal (Type DELETE for published/high-risk) */}
      {deleteConfirm && (
        <Modal
          title={deleteConfirm.type === 'single' ? 'Delete card permanently?' : `Delete ${deleteConfirm.count} cards permanently?`}
          onClose={() => {
            setDeleteConfirm(null)
            setTypeDeleteValue('')
          }}
          description={
            deleteConfirm.type === 'single'
              ? 'This card is published or high-risk. Type DELETE below to confirm.'
              : 'One or more selected cards are published or high-risk. Type DELETE below to confirm.'
          }
        >
          <div className="space-y-4">
            <label htmlFor="type-delete-confirm" className="block text-sm font-medium text-slate-700">
              Type DELETE to confirm
            </label>
            <input
              id="type-delete-confirm"
              type="text"
              value={typeDeleteValue}
              onChange={(e) => setTypeDeleteValue(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              autoComplete="off"
              aria-describedby="type-delete-hint"
            />
            <p id="type-delete-hint" className="text-sm text-slate-500">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirm(null)
                  setTypeDeleteValue('')
                }}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={typeDeleteValue !== 'DELETE'}
                onClick={() => {
                  if (deleteConfirm.type === 'single') {
                    void handleDeleteSingle(deleteConfirm.card.id)
                  } else {
                    void handleBulkDelete()
                  }
                }}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Summary */}
      {!loading && filteredCards.length > 0 && (
        <div className="text-sm text-slate-500">
          Showing {filteredCards.length} card{filteredCards.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
