'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

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

interface EditorialLibraryClientProps {
  surgeryId: string
  userName: string
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

export default function EditorialLibraryClient({ surgeryId, userName }: EditorialLibraryClientProps) {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

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

                  return (
                    <tr key={card.id} className="hover:bg-slate-50">
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
                        <div className="flex items-center gap-2">
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

      {/* Summary */}
      {!loading && filteredCards.length > 0 && (
        <div className="text-sm text-slate-500">
          Showing {filteredCards.length} card{filteredCards.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
