'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import { computeClinicalReviewCounts, getReviewStatusForSymptom } from '@/lib/clinicalReviewCounts'

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
  reviewNote?: string | null
}

interface ClinicalReviewPanelProps {
  selectedSurgery: string | null
  isSuperuser?: boolean
  adminSurgeryId?: string | null
  onPendingCountChange?: (count: number) => void
}

type FilterKey = 'pending' | 'changes-requested' | 'approved' | 'all'

export default function ClinicalReviewPanel({ 
  selectedSurgery, 
  isSuperuser = false,
  adminSurgeryId = null,
  onPendingCountChange 
}: ClinicalReviewPanelProps) {
  const [symptoms, setSymptoms] = useState<EffectiveSymptom[]>([])
  const [enabledSymptoms, setEnabledSymptoms] = useState<EffectiveSymptom[]>([])
  const [enabledSymptomKeys, setEnabledSymptomKeys] = useState<Set<string>>(new Set())
  const [reviewStatuses, setReviewStatuses] = useState<Map<string, SymptomReviewStatus>>(new Map())
  const [surgeryData, setSurgeryData] = useState<Surgery | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('pending')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'name-asc' | 'name-desc' | 'changed-new' | 'status'>('name-asc')
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [resettingAll, setResettingAll] = useState(false)
  
  // Surgery switcher for superusers
  const [surgeries, setSurgeries] = useState<Array<{ id: string; name: string }>>([])
  const [selectedSurgeryId, setSelectedSurgeryId] = useState<string | null>(selectedSurgery)
  
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerIds, setDrawerIds] = useState<{ baseSymptomId?: string; customSymptomId?: string } | null>(null)
  const [drawerReviewStatus, setDrawerReviewStatus] = useState<'PENDING' | 'APPROVED' | 'CHANGES_REQUIRED' | null>(null)
  const [drawerReviewedBy, setDrawerReviewedBy] = useState<string | null>(null)
  const [drawerReviewedAt, setDrawerReviewedAt] = useState<string | null>(null)
  const [drawerReviewNote, setDrawerReviewNote] = useState<string | null>(null)
  const drawerCloseButtonRef = useRef<HTMLButtonElement | null>(null)
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'reset-all' | 'request-changes' | 'bulk-approve' | 'approve-disabled'
    symptomId?: string
    ageGroup?: string | null
  } | null>(null)
  const [changeRequestNote, setChangeRequestNote] = useState<string>('')
  const [bulkApproving, setBulkApproving] = useState(false)

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
      // Fetch symptoms (including disabled) and enabled symptoms separately, plus review statuses
      const [symptomsRes, enabledSymptomsRes, reviewRes] = await Promise.all([
        fetch(`/api/effectiveSymptoms?surgeryId=${effectiveSurgeryId}&includeDisabled=1`, { cache: 'no-store' }),
        fetch(`/api/effectiveSymptoms?surgeryId=${effectiveSurgeryId}&includeDisabled=0`, { cache: 'no-store' }),
        fetch(`/api/admin/clinical-review-data?surgeryId=${effectiveSurgeryId}`, { cache: 'no-store' })
      ])

      if (!symptomsRes.ok) {
        throw new Error('Failed to load symptoms')
      }
      if (!enabledSymptomsRes.ok) {
        throw new Error('Failed to load enabled symptoms')
      }
      if (!reviewRes.ok) {
        throw new Error('Failed to load review data')
      }

      const symptomsData = await symptomsRes.json()
      const enabledSymptomsData = await enabledSymptomsRes.json()
      const reviewData = await reviewRes.json()

      setSymptoms(symptomsData.symptoms || [])
      setEnabledSymptoms(enabledSymptomsData.symptoms || [])
      
      // Build set of enabled symptom keys for quick lookup
      const enabledKeys = new Set(
        (enabledSymptomsData.symptoms || []).map((s: EffectiveSymptom) => `${s.id}-${s.ageGroup || ''}`)
      )
      setEnabledSymptomKeys(enabledKeys)
      
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

      const counts = computeClinicalReviewCounts(symptomsData.symptoms || [], statusMap as any)
      onPendingCountChange?.(counts.pending)
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

  const updateReviewStatus = async (symptomId: string, ageGroup: string | null, newStatus: 'PENDING' | 'APPROVED' | 'CHANGES_REQUIRED', alsoDisable?: boolean, note?: string) => {
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
          reviewNote: note || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update review status')
      }

      const updatedStatus = await response.json()
      
      // If also disabling, call the surgerySymptoms API
      if (alsoDisable && newStatus === 'CHANGES_REQUIRED') {
        const symptom = symptoms.find(s => s.id === symptomId)
        if (symptom) {
          try {
            const disableBody: any = {
              action: 'DISABLE',
              surgeryId: effectiveSurgeryId,
            }
            
            if (symptom.source === 'base' || symptom.source === 'override') {
              disableBody.baseSymptomId = symptom.baseSymptomId || symptom.id
            } else if (symptom.source === 'custom') {
              disableBody.customSymptomId = symptom.id
            }
            
            const disableRes = await fetch('/api/surgerySymptoms', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(disableBody),
            })
            
            if (!disableRes.ok) {
              console.error('Failed to disable symptom')
            } else {
              toast.success('Disabled for this surgery')
            }
          } catch (disableError) {
            console.error('Error disabling symptom:', disableError)
          }
        }
      }
      
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
      
      // Refresh data to reflect disable status
      await loadData()
      try {
        window.dispatchEvent(new CustomEvent('signposting:admin-metrics-changed'))
      } catch {}
    } catch (error) {
      console.error('Error updating review status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update review status')
    } finally {
      setUpdatingStatus(null)
    }
  }

  const handleRequestChanges = (symptomId: string, ageGroup: string | null) => {
    setConfirmDialog({
      type: 'request-changes',
      symptomId,
      ageGroup,
    })
  }

  const handleResetAll = () => {
    setConfirmDialog({ type: 'reset-all' })
  }

  const handleApprove = (symptomId: string, ageGroup: string | null) => {
    // Check if symptom is disabled
    const key = `${symptomId}-${ageGroup || ''}`
    const isDisabled = !enabledSymptomKeys.has(key)
    
    if (isDisabled) {
      // Show confirmation dialog to re-enable
      setConfirmDialog({
        type: 'approve-disabled',
        symptomId,
        ageGroup,
      })
    } else {
      // Approve directly
      updateReviewStatus(symptomId, ageGroup, 'APPROVED')
    }
  }

  const approveWithReEnable = async (symptomId: string, ageGroup: string | null, alsoEnable: boolean) => {
    if (!effectiveSurgeryId) return
    
    const key = `${symptomId}-${ageGroup || ''}`
    
    try {
      // First approve the symptom (this handles its own loading state)
      await updateReviewStatus(symptomId, ageGroup, 'APPROVED')
      
      // If user chose to re-enable, do that too
      if (alsoEnable) {
        const symptom = symptoms.find(s => s.id === symptomId)
        if (symptom) {
          try {
            const enableBody: any = {
              action: 'ENABLE_EXISTING',
              surgeryId: effectiveSurgeryId,
            }
            
            if (symptom.source === 'base' || symptom.source === 'override') {
              enableBody.baseSymptomId = symptom.baseSymptomId || symptom.id
            } else if (symptom.source === 'custom') {
              enableBody.customSymptomId = symptom.id
            }
            
            const enableRes = await fetch('/api/surgerySymptoms', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(enableBody),
            })
            
            if (!enableRes.ok) {
              console.error('Failed to enable symptom')
              toast.error('Approved but failed to enable symptom')
            } else {
              toast.success('Approved and re-enabled for this surgery')
              // Refresh data to update enabled status
              await loadData()
            }
          } catch (enableError) {
            console.error('Error enabling symptom:', enableError)
            toast.error('Approved but failed to enable symptom')
          }
        }
      }
    } finally {
      setConfirmDialog(null)
    }
  }

  const handleBulkApprove = () => {
    const pendingCount = counts.pending || 0
    if (pendingCount === 0) {
      toast.error('No pending symptoms to approve.')
      return
    }
    setConfirmDialog({ type: 'bulk-approve' })
  }

  const bulkApprovePending = async () => {
    if (!effectiveSurgeryId) return
    
    setBulkApproving(true)
    try {
      const response = await fetch('/api/admin/clinical-review/bulk-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          surgeryId: effectiveSurgeryId,
          search: search.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to bulk approve')
      }

      const result = await response.json()
      toast.success(`Approved ${result.approvedCount || 0} symptoms.`)
      
      // Refresh data and switch to pending filter to show "No results"
      await loadData()
      setActiveFilter('pending')
    } catch (error) {
      console.error('Error bulk approving:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to bulk approve')
    } finally {
      setBulkApproving(false)
      setConfirmDialog(null)
    }
  }

  const resetAllToPending = async () => {
    if (!effectiveSurgeryId) return
    
    setResettingAll(true)
    try {
      const response = await fetch('/api/admin/clinical-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'RESET_ALL',
          surgeryId: effectiveSurgeryId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reset review statuses')
      }

      const result = await response.json()
      toast.success(`Reset ${result.updated || 0} review statuses to pending`)
      
      // Refresh data
      await loadData()
    } catch (error) {
      console.error('Error resetting review statuses:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to reset review statuses')
    } finally {
      setResettingAll(false)
      setConfirmDialog(null)
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
    const c = computeClinicalReviewCounts(symptoms, reviewStatuses as any)
    return {
      pending: c.pending,
      'changes-requested': c.changesRequested,
      approved: c.approved,
      all: c.all,
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
      const reviewStatus = getReviewStatusForSymptom(symptom as any, reviewStatuses as any) as any
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

  const debugMismatch = useMemo(() => {
    const isDev = process.env.NODE_ENV !== 'production'
    if (!isDev) return null
    if (enabledSymptoms.length === 0 || symptoms.length === 0) return null
    if (symptoms.length === enabledSymptoms.length) return null
    const extras = symptoms.filter((s) => !enabledSymptomKeys.has(`${s.id}-${s.ageGroup || ''}`))
    return {
      enabledCount: enabledSymptoms.length,
      allCount: symptoms.length,
      extras,
    }
  }, [enabledSymptoms.length, symptoms, enabledSymptomKeys])

  const openDrawer = (symptom: EffectiveSymptom) => {
    // Determine if it's a base or custom symptom
    const key = `${symptom.id}-${symptom.ageGroup || ''}`
    const reviewStatus = reviewStatuses.get(key)
    
    if (symptom.source === 'base') {
      setDrawerIds({ baseSymptomId: symptom.id })
    } else if (symptom.source === 'custom') {
      setDrawerIds({ customSymptomId: symptom.id })
    } else if (symptom.source === 'override') {
      // For override, use baseSymptomId if available
      setDrawerIds({ baseSymptomId: symptom.baseSymptomId || symptom.id })
    }
    setDrawerReviewStatus(reviewStatus?.status || null)
    const reviewerName = reviewStatus?.lastReviewedBy?.name || reviewStatus?.lastReviewedBy?.email || null
    setDrawerReviewedBy(reviewerName)
    setDrawerReviewedAt(reviewStatus?.lastReviewedAt ? new Date(reviewStatus.lastReviewedAt).toISOString() : null)
    // @ts-ignore (optional field)
    setDrawerReviewNote((reviewStatus as any)?.reviewNote ?? null)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setDrawerIds(null)
    setDrawerReviewStatus(null)
    setDrawerReviewedBy(null)
    setDrawerReviewedAt(null)
    setDrawerReviewNote(null)
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
            { key: 'all' as FilterKey, label: 'All (including disabled)', title: 'Includes disabled symptoms. Your Symptom Library “In use” total shows enabled symptoms only.' },
          ]).map(item => (
            <button
              key={item.key}
              onClick={() => setActiveFilter(item.key)}
              aria-current={activeFilter === item.key ? 'page' : undefined}
              title={(item as any).title}
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
          {debugMismatch && (
            <div className="mt-3 p-2 rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-900">
              <div className="font-semibold">Debug (dev-only): count mismatch</div>
              <div className="mt-1">
                Clinical Review All: <span className="font-medium">{debugMismatch.allCount}</span> •
                Enabled (Symptom Library “In use”): <span className="font-medium">{debugMismatch.enabledCount}</span>
              </div>
              {debugMismatch.extras.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer underline">Show extra symptom(s)</summary>
                  <ul className="mt-2 space-y-1">
                    {debugMismatch.extras.map((s) => (
                      <li key={`${s.id}-${s.ageGroup || ''}`}>
                        <span className="font-medium">{s.name}</span> — <span className="font-mono">{s.id}</span>{' '}
                        <span className="text-amber-800">({s.source})</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Right pane */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:min-w-0">
            {(isSuperuser || (!!adminSurgeryId && effectiveSurgeryId === adminSurgeryId)) && (
              <select
                value={effectiveSurgeryId || ''}
                onChange={(e) => {
                  setSelectedSurgeryId(e.target.value || null)
                }}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm w-full sm:w-64 max-w-full"
                aria-label="Select surgery"
              >
                {surgeries.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            {(isSuperuser || (!!adminSurgeryId && effectiveSurgeryId === adminSurgeryId)) && effectiveSurgeryId && (
              <button
                onClick={handleResetAll}
                disabled={resettingAll || !effectiveSurgeryId}
                className="px-3 py-2 rounded-md text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resettingAll ? 'Resetting...' : 'Request re-review'}
              </button>
            )}
            {(isSuperuser || (!!adminSurgeryId && effectiveSurgeryId === adminSurgeryId)) && effectiveSurgeryId && (
              <button
                onClick={handleBulkApprove}
                disabled={bulkApproving || !effectiveSurgeryId}
                className="px-3 py-2 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkApproving ? 'Approving...' : 'Bulk approve pending'}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:ml-auto sm:min-w-0">
            <input
              type="text"
              placeholder="Search symptoms..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm w-full sm:w-64 max-w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={sort}
              onChange={e => setSort(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm w-full sm:w-56 max-w-full"
              aria-label="Sort"
            >
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="changed-new">Last changed — newest</option>
              <option value="status">Status</option>
            </select>
          </div>
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
                    <td className="px-4 py-3">
                      <a 
                        href={`/symptom/${row.symptom.id}?surgery=${effectiveSurgeryId}&ref=clinical-review`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
                      >
                        {row.symptom.name}
                      </a>
                      {row.reviewStatus?.reviewNote && (
                        <p className="text-xs text-red-700 mt-1 whitespace-pre-wrap break-words">
                          Reviewer note: {row.reviewStatus.reviewNote}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(row.status)}`}>
                          {row.status === 'CHANGES_REQUIRED' ? 'Changes requested' : row.status}
                        </span>
                        {row.reviewStatus?.reviewNote && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            Note
                          </span>
                        )}
                      </div>
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
                            onClick={() => handleApprove(row.symptom.id, row.symptom.ageGroup || null)}
                            disabled={isUpdating || row.status === 'APPROVED'}
                            className="px-3 py-1 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {row.status === 'APPROVED' ? '✓ Approved' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleRequestChanges(row.symptom.id, row.symptom.ageGroup || null)}
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

      {/* Confirmation Dialogs */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            {confirmDialog.type === 'reset-all' ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Request re-review</h3>
                <p className="text-sm text-gray-600 mb-6">
                  This will set all clinically reviewed symptoms for this surgery back to “Pending”, so they can be reviewed again. Continue?
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="px-4 py-2 rounded-md text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={resetAllToPending}
                    disabled={resettingAll}
                    className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {resettingAll ? 'Resetting...' : 'Continue'}
                  </button>
                </div>
              </>
            ) : confirmDialog.type === 'bulk-approve' ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Bulk approve pending?</h3>
                <p className="text-sm text-gray-600 mb-6">
                  This will approve {counts.pending || 0} symptoms for {surgeryData?.name || 'this surgery'}. Changes-required items will not be approved.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="px-4 py-2 rounded-md text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={bulkApprovePending}
                    disabled={bulkApproving}
                    className="px-4 py-2 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {bulkApproving ? 'Approving...' : 'Approve all'}
                  </button>
                </div>
              </>
            ) : confirmDialog.type === 'approve-disabled' ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Approve symptom</h3>
                <p className="text-sm text-gray-600 mb-6">
                  This symptom is currently disabled. Do you also want to re-enable it now?
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="px-4 py-2 rounded-md text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (confirmDialog.symptomId) {
                        approveWithReEnable(confirmDialog.symptomId, confirmDialog.ageGroup || null, false)
                      }
                    }}
                    disabled={updatingStatus !== null}
                    className="px-4 py-2 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve only
                  </button>
                  <button
                    onClick={() => {
                      if (confirmDialog.symptomId) {
                        approveWithReEnable(confirmDialog.symptomId, confirmDialog.ageGroup || null, true)
                      }
                    }}
                    disabled={updatingStatus !== null}
                    className="px-4 py-2 rounded-md text-sm font-medium bg-green-700 text-white hover:bg-green-800 disabled:opacity-50"
                  >
                    Approve and re-enable
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Changes requested</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Do you also want to disable this symptom for this surgery until the changes are made?
                </p>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700" htmlFor="change-note">Note to surgery (optional)</label>
                  <textarea
                    id="change-note"
                    rows={3}
                    value={changeRequestNote}
                    onChange={e => setChangeRequestNote(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder="E.g. Please remove the A&E advice; we don't do that locally."
                  />
                  <button
                    onClick={() => {
                      if (confirmDialog.symptomId) {
                        updateReviewStatus(confirmDialog.symptomId, confirmDialog.ageGroup || null, 'CHANGES_REQUIRED', false, changeRequestNote?.trim() || undefined)
                      }
                      setConfirmDialog(null)
                      setChangeRequestNote('')
                    }}
                    disabled={updatingStatus !== null}
                    className="px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Request changes only
                  </button>
                  <button
                    onClick={() => {
                      if (confirmDialog.symptomId) {
                        updateReviewStatus(confirmDialog.symptomId, confirmDialog.ageGroup || null, 'CHANGES_REQUIRED', true, changeRequestNote?.trim() || undefined)
                      }
                      setConfirmDialog(null)
                      setChangeRequestNote('')
                    }}
                    disabled={updatingStatus !== null}
                    className="px-4 py-2 rounded-md text-sm font-medium bg-red-700 text-white hover:bg-red-800 disabled:opacity-50"
                  >
                    Request changes and disable
                  </button>
                  <button
                    onClick={() => { setConfirmDialog(null); setChangeRequestNote('') }}
                    className="px-4 py-2 rounded-md text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && effectiveSurgeryId && (
        <SymptomPreviewDrawer
          isOpen={drawerOpen}
          onClose={closeDrawer}
          surgeryId={effectiveSurgeryId}
          baseSymptomId={drawerIds?.baseSymptomId}
          customSymptomId={drawerIds?.customSymptomId}
          reviewStatus={drawerReviewStatus}
          reviewedBy={drawerReviewedBy}
          reviewedAt={drawerReviewedAt}
          reviewNote={drawerReviewNote}
          onReEnable={() => loadData()}
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
  reviewStatus?: 'PENDING' | 'APPROVED' | 'CHANGES_REQUIRED' | null
  reviewedBy?: string | null
  reviewedAt?: string | null
  reviewNote?: string | null
  onReEnable?: () => void
  closeButtonRef?: React.RefObject<HTMLButtonElement>
}

function SymptomPreviewDrawer({ isOpen, onClose, surgeryId, baseSymptomId, customSymptomId, reviewStatus, reviewedBy, reviewedAt, reviewNote, onReEnable, closeButtonRef }: DrawerProps) {
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
    highlightedText: string | null
  }>(null)
  const [viewMode, setViewMode] = useState<'local' | 'base'>('local')
  const [reEnabling, setReEnabling] = useState(false)
  const drawerRef = useRef<HTMLDivElement | null>(null)

  const btnGrey = "px-3 py-1 rounded-md text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-100"
  const btnBlue = "px-3 py-1 rounded-md text-sm font-medium border border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white"

  const handleReEnable = async () => {
    if (!data) {
      toast.error('Symptom data not loaded')
      return
    }
    
    setReEnabling(true)
    try {
      const body: any = {
        action: 'ENABLE_EXISTING',
      }
      
      // Use statusRowId if available, otherwise fall back to baseSymptomId/customSymptomId
      if (data.statusRowId) {
        body.statusRowId = data.statusRowId
      } else if (baseSymptomId) {
        body.baseSymptomId = baseSymptomId
        body.surgeryId = surgeryId
      } else if (customSymptomId) {
        body.customSymptomId = customSymptomId
        body.surgeryId = surgeryId
      } else {
        toast.error('Cannot re-enable: missing symptom identifier')
        setReEnabling(false)
        return
      }
      
      const response = await fetch('/api/surgerySymptoms', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to re-enable symptom')
      }

      toast.success('Symptom re-enabled for this surgery')
      
      // Refresh preview data
      const params = new URLSearchParams({ surgeryId })
      if (baseSymptomId) params.append('baseSymptomId', baseSymptomId)
      else if (customSymptomId) params.append('customSymptomId', customSymptomId)
      const previewRes = await fetch(`/api/symptomPreview?${params.toString()}`)
      if (previewRes.ok) {
        const previewData = await previewRes.json()
        setData(previewData)
      }
      
      // Refresh parent panel
      onReEnable?.()
    } catch (error) {
      console.error('Error re-enabling symptom:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to re-enable symptom')
    } finally {
      setReEnabling(false)
    }
  }

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
      <div ref={drawerRef} className="absolute top-0 right-0 h-full w-full sm:w-[560px] bg-white shadow-xl border-l border-gray-200 focus:outline-none flex flex-col" role="dialog" aria-modal="true">
        {/* Header - fixed */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 flex-shrink-0">
          <div className="flex-1">
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
            {(reviewedBy && reviewedAt) && (
              <p className="text-sm text-gray-700 mt-2">Last reviewed by {reviewedBy} on {new Date(reviewedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            )}
            {reviewStatus === 'CHANGES_REQUIRED' && reviewNote && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-semibold text-red-800 mb-1">Reviewer note</p>
                <p className="text-sm text-red-800 whitespace-pre-wrap">{reviewNote}</p>
              </div>
            )}
            {data && !data.isEnabled && reviewStatus === 'CHANGES_REQUIRED' && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800 mb-2">
                  This symptom is currently disabled for this surgery because changes were requested.
                </p>
                <button
                  onClick={handleReEnable}
                  disabled={reEnabling}
                  className="px-3 py-1 rounded-md text-sm font-medium bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50"
                >
                  {reEnabling ? 'Re-enabling...' : 'Re-enable for this surgery'}
                </button>
              </div>
            )}
          </div>
          <button ref={closeButtonRef} onClick={onClose} className={btnGrey} aria-label="Close preview">Close</button>
        </div>
        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {data.highlightedText && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-red-800 mb-2">Important message</h3>
                  <p className="text-sm text-red-800 whitespace-pre-wrap">{data.highlightedText}</p>
                </div>
              )}
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
        {/* Footer - fixed */}
        <div className="px-6 py-4 border-t border-gray-200 bg-white flex-shrink-0">
          <div className="pointer-events-none h-3 -mt-3 bg-gradient-to-t from-white to-transparent" />
          {reviewStatus === 'CHANGES_REQUIRED' && (
            <p className="text-sm text-gray-600 mb-3">Make the change on the symptom page, then come back here and click “Approve”.</p>
          )}
          <div className="flex justify-end gap-2">
            {reviewStatus === 'CHANGES_REQUIRED' && (baseSymptomId || customSymptomId) && (
              <a
                href={baseSymptomId ? `/symptom/${baseSymptomId}?surgery=${surgeryId}&from=clinical-review` : `/symptom/${customSymptomId}?surgery=${surgeryId}&from=clinical-review`}
                className="px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
              >
                Open symptom page
              </a>
            )}
            <button onClick={onClose} className={btnGrey}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

