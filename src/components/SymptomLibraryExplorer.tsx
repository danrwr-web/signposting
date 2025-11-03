'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import NewSymptomModal from '@/components/NewSymptomModal'

type SymptomStatus = 'BASE' | 'MODIFIED' | 'LOCAL_ONLY' | 'DISABLED'

interface InUseSymptom {
  symptomId: string
  name: string
  status: SymptomStatus
  isEnabled: boolean
  canRevertToBase: boolean
  statusRowId?: string
  lastEditedAt?: string | null
  lastEditedBy?: string | null
}

interface AvailableSymptom {
  baseSymptomId: string
  name: string
}

interface CustomOnlySymptom {
  customSymptomId: string
  name: string
  isEnabled: boolean
}

interface SurgerySymptomsResponse {
  inUse: InUseSymptom[]
  available: AvailableSymptom[]
  customOnly: CustomOnlySymptom[]
}

interface SymptomLibraryExplorerProps {
  surgeryId: string | null
}

type FilterKey = 'inuse' | 'available' | 'modified' | 'localonly' | 'disabled' | 'allbase'

const btnBase = "px-3 py-1 rounded-md text-sm font-medium transition-colors"
const btnRed  = `${btnBase} bg-red-600 text-white hover:bg-red-700`
const btnBlue = `${btnBase} border border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white`
const btnGrey = `${btnBase} border border-gray-300 text-gray-700 hover:bg-gray-100`

export default function SymptomLibraryExplorer({ surgeryId }: SymptomLibraryExplorerProps) {
  const [libraryData, setLibraryData] = useState<SurgerySymptomsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'name-asc' | 'name-desc' | 'changed-new' | 'changed-old' | 'status'>('name-asc')
  const [activeFilter, setActiveFilter] = useState<FilterKey>('inuse')
  const [isSuperuser, setIsSuperuser] = useState<boolean>(false)
  const [sessionUser, setSessionUser] = useState<{ globalRole?: string; surgeryId?: string } | null>(null)

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerIds, setDrawerIds] = useState<{ baseSymptomId?: string; customSymptomId?: string } | null>(null)
  const drawerCloseButtonRef = useRef<HTMLButtonElement | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [surgeries, setSurgeries] = useState<Array<{ id: string; name: string }>>([])

  const effectiveSurgeryId = useMemo(() => {
    return surgeryId || sessionUser?.surgeryId || null
  }, [surgeryId, sessionUser])

  const loadRole = async () => {
    try {
      const me = await fetch('/api/user/profile', { cache: 'no-store' })
      if (me.ok) {
        const meJson = await me.json()
        const role = meJson?.globalRole || meJson?.user?.globalRole
        setIsSuperuser(role === 'SUPERUSER')
        setSessionUser({ globalRole: role, surgeryId: meJson?.surgeryId || meJson?.user?.surgeryId })
      }
    } catch {}
  }

  const loadLibraryData = async (sid: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/surgerySymptoms?surgeryId=${sid}`, { cache: 'no-store' })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        toast.error(err?.error || 'Failed to load symptom library')
        setLibraryData({ inUse: [], available: [], customOnly: [] })
        return
      }
      const data = await response.json()
      setLibraryData({
        inUse: data?.inUse ?? [],
        available: data?.available ?? [],
        customOnly: data?.customOnly ?? []
      })
    } catch (e) {
      console.error(e)
      toast.error('Failed to load symptom library')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRole()
  }, [])

  useEffect(() => {
    if (effectiveSurgeryId) {
      loadLibraryData(effectiveSurgeryId)
    } else {
      setLibraryData(null)
    }
  }, [effectiveSurgeryId])

  // Actions to backend
  const handleAction = async (action: string, payload: Record<string, any>) => {
    if (!effectiveSurgeryId) return
    setLoading(true)
    try {
      const response = await fetch('/api/surgerySymptoms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, surgeryId: effectiveSurgeryId, ...payload })
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        toast.error(errorData.error || 'Operation failed')
        return
      }
      toast.success('Operation successful')
      await loadLibraryData(effectiveSurgeryId)
    } catch (e) {
      console.error(e)
      toast.error('Operation failed')
    } finally {
      setLoading(false)
    }
  }

  const openDrawer = (ids: { baseSymptomId?: string; customSymptomId?: string }) => {
    setDrawerIds(ids)
    setDrawerOpen(true)
    // focus will be handled by drawer component via autoFocus on close button
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setDrawerIds(null)
  }

  const ensureSurgeries = async () => {
    if (!isSuperuser || surgeries.length) return
    try {
      const res = await fetch('/api/surgeries/list', { cache: 'no-store' })
      if (res.ok) {
        const list = await res.json()
        setSurgeries(Array.isArray(list) ? list : [])
      }
    } catch {}
  }

  const formatLastEdited = (lastEditedAt?: string | null, lastEditedBy?: string | null) => {
    if (!lastEditedAt || !lastEditedBy) return '—'
    const date = new Date(lastEditedAt)
    return `${lastEditedBy} • ${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
  }

  // Build folder counts
  const counts = useMemo(() => {
    const inUse = libraryData?.inUse || []
    const available = libraryData?.available || []
    const inUseEnabled = inUse.filter(s => s.isEnabled)
    const modified = inUseEnabled.filter(s => s.status === 'MODIFIED')
    const localOnly = inUseEnabled.filter(s => s.status === 'LOCAL_ONLY')
    const disabled = inUse.filter(s => s.status === 'DISABLED')
    const allBase = available.length + inUse.filter(s => s.status !== 'LOCAL_ONLY').length
    return {
      inuse: inUseEnabled.length,
      available: available.length,
      modified: modified.length,
      localonly: localOnly.length,
      disabled: disabled.length,
      allbase: allBase
    }
  }, [libraryData])

  // Compute rows for current filter
  type Row = {
    key: string
    kind: 'inuse' | 'available'
    name: string
    status: SymptomStatus | 'AVAILABLE'
    isEnabled: boolean
    canRevertToBase?: boolean
    statusRowId?: string
    baseSymptomId?: string
    customSymptomId?: string
    lastEditedAt?: string | null
    lastEditedBy?: string | null
  }

  const filteredRows: Row[] = useMemo(() => {
    if (!libraryData) return []
    const rows: Row[] = []
    const pushInUse = (s: InUseSymptom) => rows.push({
      key: `in-${s.symptomId}`,
      kind: 'inuse',
      name: s.name,
      status: s.status,
      isEnabled: s.isEnabled,
      canRevertToBase: s.canRevertToBase,
      statusRowId: s.statusRowId,
      // If it's local only, this id refers to custom; otherwise base
      ...(s.status === 'LOCAL_ONLY' ? { customSymptomId: s.symptomId } : { baseSymptomId: s.symptomId }),
      lastEditedAt: s.lastEditedAt,
      lastEditedBy: s.lastEditedBy
    })

    const pushAvailable = (s: AvailableSymptom) => rows.push({
      key: `av-${s.baseSymptomId}`,
      kind: 'available',
      name: s.name,
      status: 'AVAILABLE',
      isEnabled: false,
      baseSymptomId: s.baseSymptomId
    })

    switch (activeFilter) {
      case 'inuse':
        libraryData.inUse.filter(s => s.isEnabled).forEach(pushInUse)
        break
      case 'available':
        libraryData.available.forEach(pushAvailable)
        break
      case 'modified':
        libraryData.inUse.filter(s => s.isEnabled && s.status === 'MODIFIED').forEach(pushInUse)
        break
      case 'localonly':
        libraryData.inUse.filter(s => s.isEnabled && s.status === 'LOCAL_ONLY').forEach(pushInUse)
        break
      case 'disabled':
        libraryData.inUse.filter(s => s.status === 'DISABLED').forEach(pushInUse)
        break
      case 'allbase':
        // Superuser only: available + inUse that are base/modified/disabled (not local-only)
        libraryData.available.forEach(pushAvailable)
        libraryData.inUse.filter(s => s.status !== 'LOCAL_ONLY').forEach(pushInUse)
        break
    }

    // Search by name (client-side)
    const q = search.trim().toLowerCase()
    const searched = q ? rows.filter(r => r.name.toLowerCase().includes(q)) : rows

    // Sort
    const sorted = [...searched].sort((a, b) => {
      if (sort === 'name-asc') return a.name.localeCompare(b.name)
      if (sort === 'name-desc') return b.name.localeCompare(a.name)
      if (sort === 'status') return String(a.status).localeCompare(String(b.status))
      const aTime = a.lastEditedAt ? new Date(a.lastEditedAt).getTime() : -Infinity
      const bTime = b.lastEditedAt ? new Date(b.lastEditedAt).getTime() : -Infinity
      if (sort === 'changed-new') return bTime - aTime
      if (sort === 'changed-old') return aTime - bTime
      return 0
    })

    return sorted
  }, [libraryData, activeFilter, search, sort])

  const getStatusLabel = (status: Row['status']) => {
    switch (status) {
      case 'BASE': return 'Base (unmodified)'
      case 'MODIFIED': return 'Modified locally'
      case 'LOCAL_ONLY': return 'Local only'
      case 'DISABLED': return 'Disabled'
      case 'AVAILABLE': return 'Available'
      default: return String(status)
    }
  }

  const getStatusBadgeColor = (status: Row['status']) => {
    switch (status) {
      case 'BASE': return 'bg-green-100 text-green-800'
      case 'MODIFIED': return 'bg-blue-100 text-blue-800'
      case 'LOCAL_ONLY': return 'bg-purple-100 text-purple-800'
      case 'DISABLED': return 'bg-gray-100 text-gray-800'
      case 'AVAILABLE': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!effectiveSurgeryId) {
    return (
      <div className="p-6 text-gray-600">Select a surgery to view its symptom library</div>
    )
  }

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <nav role="navigation" aria-label="Symptom folders" className="w-[270px] shrink-0 sticky top-0 self-start">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          {([
            { key: 'inuse', label: 'In use' },
            { key: 'available', label: 'Available' },
            { key: 'modified', label: 'Modified locally' },
            { key: 'localonly', label: 'Local-only' },
            { key: 'disabled', label: 'Disabled' },
            ...(isSuperuser ? [{ key: 'allbase', label: 'All base' }] as any : [])
          ] as Array<{ key: FilterKey; label: string }>).map(item => (
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
            <option value="changed-old">Last changed — oldest</option>
            <option value="status">Status</option>
          </select>
          <button
            onClick={async () => { await ensureSurgeries(); setIsAddOpen(true) }}
            className="px-4 py-2 rounded-md text-sm font-medium bg-nhs-green text-white hover:bg-green-600"
          >
            Add Symptom
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-md border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="w-[40%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symptom</th>
                <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visible to reception?</th>
                <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last changed</th>
                <th className="w-[10%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && (!libraryData || filteredRows.length === 0) && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={5}>Loading...</td>
                </tr>
              )}
              {!loading && filteredRows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={5}>No results</td>
                </tr>
              )}
              {filteredRows.map(row => (
                <tr key={row.key}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(row.status)}`}>
                      {getStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.isEnabled ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatLastEdited(row.lastEditedAt, row.lastEditedBy)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <button
                        onClick={() => openDrawer({ baseSymptomId: row.baseSymptomId, customSymptomId: row.customSymptomId })}
                        className={btnBlue}
                        disabled={loading}
                        aria-label={`View ${row.name}`}
                      >
                        View
                      </button>
                      {row.kind === 'inuse' && row.isEnabled && (
                        <button
                          onClick={() => handleAction('DISABLE', { statusRowId: row.statusRowId, baseSymptomId: row.statusRowId ? undefined : row.baseSymptomId })}
                          className={btnRed}
                          disabled={loading}
                        >
                          Disable
                        </button>
                      )}
                      {row.kind === 'inuse' && !row.isEnabled && row.status !== 'LOCAL_ONLY' && (
                        <button
                          onClick={() => handleAction('ENABLE_EXISTING', { statusRowId: row.statusRowId, baseSymptomId: row.statusRowId ? undefined : row.baseSymptomId })}
                          className={btnBlue}
                          disabled={loading}
                        >
                          Enable
                        </button>
                      )}
                      {row.kind === 'available' && row.baseSymptomId && (
                        <button
                          onClick={() => handleAction('ENABLE_BASE', { baseSymptomId: row.baseSymptomId })}
                          className={btnBlue}
                          disabled={loading}
                        >
                          Enable at this surgery
                        </button>
                      )}
                      {row.kind === 'inuse' && row.canRevertToBase && (
                        <button
                          onClick={() => handleAction('REVERT_TO_BASE', {
                            statusRowId: row.statusRowId,
                            baseSymptomId: row.baseSymptomId
                          })}
                          className={btnBlue}
                          disabled={loading}
                        >
                          Revert
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
          onEnabled={() => {
            loadLibraryData(effectiveSurgeryId)
            closeDrawer()
          }}
          closeButtonRef={drawerCloseButtonRef}
        />
      )}

      {/* Add Symptom modal */}
      {isAddOpen && (
        <NewSymptomModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          isSuperuser={isSuperuser}
          currentSurgeryId={effectiveSurgeryId}
          surgeries={surgeries}
          onCreated={() => { setIsAddOpen(false); if (effectiveSurgeryId) loadLibraryData(effectiveSurgeryId) }}
        />
      )}
    </div>
  )
}

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  surgeryId: string
  baseSymptomId?: string
  customSymptomId?: string
  onEnabled?: () => void
  closeButtonRef?: React.RefObject<HTMLButtonElement>
}

function SymptomPreviewDrawer({ isOpen, onClose, surgeryId, baseSymptomId, customSymptomId, onEnabled, closeButtonRef }: DrawerProps) {
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

  const handleEnable = async () => {
    if (!surgeryId) return
    try {
      const response = await fetch('/api/surgerySymptoms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: data?.statusRowId ? 'ENABLE_EXISTING' : (baseSymptomId ? 'ENABLE_BASE' : 'ENABLE_EXISTING'),
          surgeryId,
          ...(data?.statusRowId ? { statusRowId: data.statusRowId } : {}),
          ...(baseSymptomId ? { baseSymptomId } : {}),
          ...(customSymptomId ? { customSymptomId } : {})
        })
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        toast.error(errorData.error || 'Failed to enable symptom')
        return
      }
      toast.success('Enabled')
      onEnabled?.()
    } catch (e) {
      console.error(e)
      toast.error('Failed to enable symptom')
    }
  }

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
        <div className="px-6 py-4 h-[calc(100%-156px)] overflow-y-auto">
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
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className={btnGrey}>Close</button>
          {data && !data.isEnabled && data.canEnable && (
            <button onClick={handleEnable} className={btnBlue}>Enable at this surgery</button>
          )}
        </div>
      </div>
    </div>
  )
}


