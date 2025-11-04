'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'

interface Surgery {
  id: string
  name: string
  requiresClinicalReview: boolean
  lastClinicalReviewAt: Date | null
  lastClinicalReviewer: {
    id: string
    email: string
    name: string | null
  } | null
}

interface SymptomReviewStatus {
  id: string
  symptomId: string
  ageGroup: string | null
  status: 'PENDING' | 'APPROVED' | 'CHANGES_REQUIRED'
  lastReviewedAt: Date | null
  lastReviewedBy: {
    id: string
    email: string
    name: string | null
  } | null
}

interface ClinicalReviewPanelProps {
  selectedSurgery: string | null
  isSuperuser?: boolean
  onPendingCountChange?: (count: number) => void
}

type FilterKey = 'pending' | 'changes-requested' | 'approved' | 'all'

export default function ClinicalReviewPanel({ 
  selectedSurgery, 
  isSuperuser = false,
  onPendingCountChange 
}: ClinicalReviewPanelProps) {
  const [symptoms, setSymptoms] = useState<EffectiveSymptom[]>([])
  const [reviewStatuses, setReviewStatuses] = useState<Map<string, SymptomReviewStatus>>(new Map())
  const [surgeryData, setSurgeryData] = useState<Surgery | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('pending')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'name-asc' | 'name-desc' | 'changed-new' | 'status'>('name-asc')
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  
  // Surgery switcher for superusers
  const [surgeries, setSurgeries] = useState<Array<{ id: string; name: string }>>([])
  const [selectedSurgeryId, setSelectedSurgeryId] = useState<string | null>(selectedSurgery)
  
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerIds, setDrawerIds] = useState<{ baseSymptomId?: string; customSymptomId?: string } | null>(null)
  const drawerCloseButtonRef = useRef<HTMLButtonElement | null>(null)

  // Determine effective surgery ID
  const effectiveSurgeryId = useMemo(() => {
    if (isSuperuser) {
      return selectedSurgeryId || selectedSurgery || null
    }
    return selectedSurgery || null
  }, [selectedSurgery, selectedSurgeryId, isSuperuser])

  // Load surgeries list for superusers
  const ensureSurgeries = async () => {
    if (!isSuperuser || surgeries.length) return
    try {
      const res = await fetch('/api/admin/surgeries', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const arr = Array.isArray(data) ? data : (Array.isArray(data?.surgeries) ? data.surgeries : [])
        const list: Array<{ id: string; name: string }> = arr.map((s: any) => ({ id: s.id, name: s.name }))
        setSurgeries(list)
        if (!selectedSurgeryId && list.length > 0) {
          setSelectedSurgeryId(list[0].id)
        }
      }
    } catch {}
  }

  useEffect(() => {
    if (isSuperuser) {
      ensureSurgeries()
    }
  }, [isSuperuser])

  // Update selectedSurgeryId when selectedSurgery prop changes
  useEffect(() => {
    if (selectedSurgery) {
      setSelectedSurgeryId(selectedSurgery)
    }
  }, [selectedSurgery])

  // Load clinical review data
  const loadData = async () => {
    if (!effectiveSurgeryId) {
      setSymptoms([])
      setReviewStatuses(new Map())
      setSurgeryData(null)
      onPendingCountChange?.(0)
      return
    }

    setLoading(true)
    try {
      // Fetch symptoms and review statuses
      const [symptomsRes, reviewRes] = await Promise.all([
        fetch(`/api/effectiveSymptoms?surgeryId=${effectiveSurgeryId}`, { cache: 'no-store' }),
        fetch(`/api/admin/clinical-review-data?surgeryId=${effectiveSurgeryId}`, { cache: 'no-store' })
      ])

      if (!symptomsRes.ok) {
        throw new Error('Failed to load symptoms')
      }
      if (!reviewRes.ok) {
        throw new Error('Failed to load review data')
      }

      const symptomsData = await symptomsRes.json()
      const reviewData = await reviewRes.json()

      setSymptoms(symptomsData.symptoms || [])
      
      // Convert review statuses array to Map
      const statusMap = new Map<string, SymptomReviewStatus>()
      if (Array.isArray(reviewData.reviewStatuses)) {
        reviewData.reviewStatuses.forEach((rs: SymptomReviewStatus) => {
          const key = `${rs.symptomId}-${rs.ageGroup || ''}`
          statusMap.set(key, rs)
        })
      }
      setReviewStatuses(statusMap)
      setSurgeryData(reviewData.surgery || null)

      // Calculate pending count
      const reviewedSymptomKeys = new Set(statusMap.keys())
      const unreviewedCount = symptomsData.symptoms.filter((s: EffectiveSymptom) => {
        const key = `${s.id}-${s.ageGroup || ''}`
        return !reviewedSymptomKeys.has(key)
      }).length
      const explicitPendingCount = Array.from(statusMap.values()).filter(rs => rs.status === 'PENDING').length
      const pendingCount = unreviewedCount + explicitPendingCount

      onPendingCountChange?.(pendingCount)
    } catch (error) {
      console.error('Error loading clinical review data:', error)
      toast.error('Failed to load clinical review data')
      setSymptoms([])
      setReviewStatuses(new Map())
      setSurgeryData(null)
      onPendingCountChange?.(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [effectiveSurgeryId])

  const updateReviewStatus = async (symptomId: string, ageGroup: string | null, newStatus: 'PENDING' | 'APPROVED' | 'CHANGES_REQUIRED') => {
    if (!effectiveSurgeryId) return

    const key = `${symptomId}-${ageGroup || ''}`
    setUpdatingStatus(key)

    try {
      const response = await fetch('/api/admin/review-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          surgeryId: effectiveSurgeryId,
          symptomId,
          ageGroup: ageGroup || null,
          newStatus,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update review status')
      }

      const updatedStatus = await response.json()
      
      // Update local state and recalculate pending count
      setReviewStatuses(prev => {
        const next = new Map(prev)
        next.set(key, updatedStatus)
        
        // Recalculate pending count
        const reviewedSymptomKeys = new Set(Array.from(next.keys()))
        const unreviewedCount = symptoms.filter(s => {
          const k = `${s.id}-${s.ageGroup || ''}`
          return !reviewedSymptomKeys.has(k)
        }).length
        const explicitPendingCount = Array.from(next.values()).filter(rs => rs.status === 'PENDING').length
        const pendingCount = unreviewedCount + explicitPendingCount
        onPendingCountChange?.(pendingCount)
        
        return next
      })

      toast.success(`Symptom marked as ${newStatus === 'APPROVED' ? 'Approved' : newStatus === 'CHANGES_REQUIRED' ? 'Changes requested' : 'Pending'}`)
    } catch (error) {
      console.error('Error updating review status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update review status')
    } finally {
      setUpdatingStatus(null)
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return null
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800'
      case 'CHANGES_REQUIRED':
        return 'bg-red-100 text-red-800'
      case 'PENDING':
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  // Calculate counts
  const counts = useMemo(() => {
    const reviewedSymptomKeys = new Set(reviewStatuses.keys())
    const unreviewed = symptoms.filter(s => {
      const key = `${s.id}-${s.ageGroup || ''}`
      return !reviewedSymptomKeys.has(key)
    }).length
    const explicitPending = Array.from(reviewStatuses.values()).filter(rs => rs.status === 'PENDING').length
    const pending = unreviewed + explicitPending
    const approved = Array.from(reviewStatuses.values()).filter(rs => rs.status === 'APPROVED').length
    const changesRequested = Array.from(reviewStatuses.values()).filter(rs => rs.status === 'CHANGES_REQUIRED').length
    const all = symptoms.length

    return {
      pending,
      'changes-requested': changesRequested,
      approved,
      all
    }
  }, [symptoms, reviewStatuses])

  // Filter and sort rows
  type Row = {
    symptom: EffectiveSymptom
    status: 'PENDING' | 'APPROVED' | 'CHANGES_REQUIRED'
    reviewStatus: SymptomReviewStatus | null
  }

  const filteredRows: Row[] = useMemo(() => {
    let rows: Row[] = symptoms.map(symptom => {
      const key = `${symptom.id}-${symptom.ageGroup || ''}`
      const reviewStatus = reviewStatuses.get(key) || null
      const status = reviewStatus?.status || 'PENDING'
      return { symptom, status, reviewStatus }
    })

    // Apply filter
    switch (activeFilter) {
      case 'pending':
        rows = rows.filter(r => r.status === 'PENDING')
        break
      case 'changes-requested':
        rows = rows.filter(r => r.status === 'CHANGES_REQUIRED')
        break
      case 'approved':
        rows = rows.filter(r => r.status === 'APPROVED')
        break
      case 'all':
        // Show all
        break
    }

    // Apply search
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(r => r.symptom.name.toLowerCase().includes(q))
    }

    // Apply sort
    rows.sort((a, b) => {
      if (sort === 'name-asc') return a.symptom.name.localeCompare(b.symptom.name)
      if (sort === 'name-desc') return b.symptom.name.localeCompare(a.symptom.name)
      if (sort === 'status') return a.status.localeCompare(b.status)
      // changed-new
      const aTime = a.reviewStatus?.lastReviewedAt ? new Date(a.reviewStatus.lastReviewedAt).getTime() : -Infinity
      const bTime = b.reviewStatus?.lastReviewedAt ? new Date(b.reviewStatus.lastReviewedAt).getTime() : -Infinity
      return bTime - aTime
    })

    return rows
  }, [symptoms, reviewStatuses, activeFilter, search, sort])

  const openDrawer = (symptom: EffectiveSymptom) => {
    // Determine if it's a base or custom symptom
    if (symptom.source === 'base') {
      setDrawerIds({ baseSymptomId: symptom.id })
    } else if (symptom.source === 'custom') {
      setDrawerIds({ customSymptomId: symptom.id })
    } else if (symptom.source === 'override') {
      // For override, use baseSymptomId if available
      setDrawerIds({ baseSymptomId: symptom.baseSymptomId || symptom.id })
    }
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setDrawerIds(null)
  }

  if (!effectiveSurgeryId) {
    return (
      <div className="p-6 text-gray-600">Select a surgery to view clinical review items</div>
    )
  }

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <nav role="navigation" aria-label="Review filters" className="w-[270px] shrink-0 sticky top-0 self-start">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          {([
            { key: 'pending' as FilterKey, label: 'Pending' },
            { key: 'changes-requested' as FilterKey, label: 'Changes requested' },
            { key: 'approved' as FilterKey, label: 'Approved' },
            { key: 'all' as FilterKey, label: 'All' },
          ]).map(item => (
            <button
              key={item.key}
              onClick={() => setActiveFilter(item.key)}
              aria-current={activeFilter === item.key ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm mb-1 text-left ${
                activeFilter === item.key ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'hover:bg-gray-50'
              }`}
            >
              <span>{item.label}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {counts[item.key] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Right pane */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end mb-3">
          {isSuperuser && (
            <select
              value={effectiveSurgeryId || ''}
              onChange={(e) => {
                setSelectedSurgeryId(e.target.value || null)
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm w-full sm:w-64"
              aria-label="Select surgery"
            >
              {surgeries.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <input
            type="text"
            placeholder="Search symptoms..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={sort}
            onChange={e => setSort(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm w-full sm:w-56"
            aria-label="Sort"
          >
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="changed-new">Last changed — newest</option>
            <option value="status">Status</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-md border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="w-[30%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symptom</th>
                <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                {isSuperuser && (
                  <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Surgery</th>
                )}
                <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last changed</th>
                <th className="w-[25%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && filteredRows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={isSuperuser ? 5 : 4}>Loading...</td>
                </tr>
              )}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={isSuperuser ? 5 : 4}>No results</td>
                </tr>
              )}
              {filteredRows.map(row => {
                const key = `${row.symptom.id}-${row.symptom.ageGroup || ''}`
                const isUpdating = updatingStatus === key
                return (
                  <tr key={row.symptom.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.symptom.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(row.status)}`}>
                        {row.status === 'CHANGES_REQUIRED' ? 'Changes requested' : row.status}
                      </span>
                    </td>
                    {isSuperuser && surgeryData && (
                      <td className="px-4 py-3 text-sm text-gray-600">{surgeryData.name}</td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {row.reviewStatus?.lastReviewedAt ? (
                        <div>
                          <div>{formatDate(row.reviewStatus.lastReviewedAt)}</div>
                          {row.reviewStatus.lastReviewedBy && (
                            <div className="text-xs text-gray-400">
                              by {row.reviewStatus.lastReviewedBy.name || row.reviewStatus.lastReviewedBy.email}
                            </div>
                          )}
                        </div>
                      ) : (
                        'Not reviewed'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => openDrawer(row.symptom)}
                          className="px-3 py-1 rounded-md text-sm font-medium border border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors"
                          disabled={loading}
                        >
                          View
                        </button>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => updateReviewStatus(row.symptom.id, row.symptom.ageGroup || null, 'APPROVED')}
                            disabled={isUpdating || row.status === 'APPROVED'}
                            className="px-3 py-1 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {row.status === 'APPROVED' ? '✓ Approved' : 'Approve'}
                          </button>
                          <button
                            onClick={() => updateReviewStatus(row.symptom.id, row.symptom.ageGroup || null, 'CHANGES_REQUIRED')}
                            disabled={isUpdating || row.status === 'CHANGES_REQUIRED'}
                            className="px-3 py-1 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {row.status === 'CHANGES_REQUIRED' ? '✓ Changes requested' : 'Request changes'}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer */}
      {drawerOpen && effectiveSurgeryId && (
        <SymptomPreviewDrawer
          isOpen={drawerOpen}
          onClose={closeDrawer}
          surgeryId={effectiveSurgeryId}
          baseSymptomId={drawerIds?.baseSymptomId}
          customSymptomId={drawerIds?.customSymptomId}
          closeButtonRef={drawerCloseButtonRef}
        />
      )}
    </div>
  )
}

// Drawer component (reused from SymptomLibraryExplorer)
interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  surgeryId: string
  baseSymptomId?: string
  customSymptomId?: string
  closeButtonRef?: React.RefObject<HTMLButtonElement>
}

function SymptomPreviewDrawer({ isOpen, onClose, surgeryId, baseSymptomId, customSymptomId, closeButtonRef }: DrawerProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<null | {
    name: string
    status: 'BASE' | 'MODIFIED' | 'LOCAL_ONLY'
    isEnabled: boolean
    canEnable: boolean
    lastEditedBy: string | null
    lastEditedAt: string | null
    briefInstruction: string | null
    instructionsHtml: string | null
    baseInstructionsHtml: string | null
    statusRowId: string | null
  }>(null)
  const [viewMode, setViewMode] = useState<'local' | 'base'>('local')
  const drawerRef = useRef<HTMLDivElement | null>(null)

  const btnGrey = "px-3 py-1 rounded-md text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-100"
  const btnBlue = "px-3 py-1 rounded-md text-sm font-medium border border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white"

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Tab') {
        // focus trap
        const root = drawerRef.current
        if (!root) return
        const focusables = root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null
        if (e.shiftKey) {
          if (active === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (active === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || !surgeryId || (!baseSymptomId && !customSymptomId)) {
      setData(null)
      setViewMode('local')
      return
    }
    const fetchPreview = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ surgeryId })
        if (baseSymptomId) params.append('baseSymptomId', baseSymptomId)
        else if (customSymptomId) params.append('customSymptomId', customSymptomId)
        const response = await fetch(`/api/symptomPreview?${params.toString()}`)
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          toast.error(errorData.error || 'Failed to load preview')
          return
        }
        const json = await response.json()
        setData(json)
        setViewMode(json.status === 'MODIFIED' ? 'local' : 'local')
      } catch (e) {
        console.error(e)
        toast.error('Failed to load preview')
      } finally {
        setLoading(false)
      }
    }
    fetchPreview()
  }, [isOpen, surgeryId, baseSymptomId, customSymptomId])

  useEffect(() => {
    // focus first actionable element
    if (isOpen && closeButtonRef?.current) {
      closeButtonRef.current.focus()
    }
  }, [isOpen, closeButtonRef])

  const currentHtml = data?.status === 'MODIFIED' && viewMode === 'base' ? data?.baseInstructionsHtml : data?.instructionsHtml

  const formatLastEdited = (lastEditedAt?: string | null, lastEditedBy?: string | null) => {
    if (!lastEditedAt || !lastEditedBy) return '—'
    const date = new Date(lastEditedAt)
    return `${lastEditedBy} • ${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
  }

  if (!isOpen) return null

  const statusBadge = data ? (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
      data.status === 'BASE' ? 'bg-green-100 text-green-800' : data.status === 'MODIFIED' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
    }`}>
      {data.status === 'BASE' ? 'Base (unmodified)' : data.status === 'MODIFIED' ? 'Modified locally' : 'Local only'}
    </span>
  ) : null

  return (
    <div className="fixed inset-0 z-40">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      {/* panel */}
      <div ref={drawerRef} className="absolute top-0 right-0 h-full w-full sm:w-[560px] bg-white shadow-xl border-l border-gray-200 focus:outline-none" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{data?.name || 'Loading...'} — Preview (read-only)</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {statusBadge}
              {data && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  Visible to reception: {data.isEnabled ? 'Yes' : 'No'}
                </span>
              )}
            </div>
            {data && (
              <p className="text-sm text-gray-600 mt-2">Last changed: {formatLastEdited(data.lastEditedAt, data.lastEditedBy)}</p>
            )}
          </div>
          <button ref={closeButtonRef} onClick={onClose} className={btnGrey} aria-label="Close preview">Close</button>
        </div>
        <div className="px-6 py-4 h-[calc(100%-176px)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : data ? (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Brief instruction</h3>
                <p className="text-sm text-gray-700">{data.briefInstruction || '—'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">Full instruction</h3>
                  {data.status === 'MODIFIED' && data.baseInstructionsHtml && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewMode('local')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'local' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                      >
                        Local wording
                      </button>
                      <button
                        onClick={() => setViewMode('base')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'base' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                      >
                        Base wording
                      </button>
                    </div>
                  )}
                </div>
                {currentHtml ? (
                  <div className="prose max-w-none [&_a]:pointer-events-none [&_a]:opacity-60" dangerouslySetInnerHTML={{ __html: currentHtml }} />
                ) : (
                  <p className="text-sm text-gray-700">—</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-600">No preview data available</p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <div className="pointer-events-none h-3 -mt-3 bg-gradient-to-t from-white to-transparent" />
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className={btnGrey}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

