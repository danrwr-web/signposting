'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import SymptomPreviewModal from './SymptomPreviewModal'
import NewSymptomModal from './NewSymptomModal'

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

interface SymptomLibraryProps {
  surgeryId: string | null
}

export default function SymptomLibrary({ surgeryId }: SymptomLibraryProps) {
  const [libraryData, setLibraryData] = useState<SurgerySymptomsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIds, setPreviewIds] = useState<{ baseSymptomId?: string; customSymptomId?: string } | null>(null)
  const [currentSurgeryId, setCurrentSurgeryId] = useState<string | null>(surgeryId)
  const [surgeries, setSurgeries] = useState<Array<{ id: string; name: string }>>([])
  const [isSuperuser, setIsSuperuser] = useState<boolean>(false)
  const [showNewModal, setShowNewModal] = useState(false)

  const loadLibraryData = async () => {
    if (!currentSurgeryId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/surgerySymptoms?surgeryId=${currentSurgeryId}`, {
        cache: 'no-store'
      })

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('Superuser access required')
        } else {
          toast.error('Failed to load symptom library')
        }
        return
      }

      const data = await response.json()
      setLibraryData(data)
    } catch (error) {
      console.error('Error loading symptom library:', error)
      toast.error('Failed to load symptom library')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCurrentSurgeryId(surgeryId)
  }, [surgeryId])

  useEffect(() => {
    if (currentSurgeryId) {
      loadLibraryData()
    }
  }, [currentSurgeryId])

  // Load surgeries and role for superuser context label
  useEffect(() => {
    const init = async () => {
      try {
        const me = await fetch('/api/user/profile')
        if (me.ok) {
          const meJson = await me.json()
          const role = meJson?.globalRole || meJson?.user?.globalRole
          setIsSuperuser(role === 'SUPERUSER')
        }
      } catch {}

      try {
        const res = await fetch('/api/surgeries/list')
        if (!res.ok) return
        const data = await res.json()
        setSurgeries(data)
        if (!surgeryId && data.length > 0) {
          setCurrentSurgeryId(data[0].id)
        }
      } catch (e) {
        console.error('Failed to load surgeries', e)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAction = async (action: string, payload: Record<string, any>) => {
    if (!surgeryId) return

    setLoading(true)
    try {
      const response = await fetch('/api/surgerySymptoms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          surgeryId,
          ...payload
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        toast.error(errorData.error || 'Operation failed')
        return
      }

      toast.success('Operation successful')
      // Reload library data
      loadLibraryData()
    } catch (error) {
      console.error('Error performing action:', error)
      toast.error('Operation failed')
    } finally {
      setLoading(false)
    }
  }

  const formatLastEdited = (lastEditedAt?: string | null, lastEditedBy?: string | null) => {
    if (!lastEditedAt || !lastEditedBy) return '-'
    const date = new Date(lastEditedAt)
    return `${lastEditedBy} • ${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
  }

  const handleEnableAllBase = async () => {
    if (!surgeryId) return
    await handleAction('ENABLE_ALL_BASE', {})
  }

  const handlePreview = (ids: { baseSymptomId?: string; customSymptomId?: string }) => {
    setPreviewIds(ids)
    setPreviewOpen(true)
  }

  const getStatusBadgeColor = (status: SymptomStatus) => {
    switch (status) {
      case 'BASE':
        return 'bg-green-100 text-green-800'
      case 'MODIFIED':
        return 'bg-blue-100 text-blue-800'
      case 'LOCAL_ONLY':
        return 'bg-purple-100 text-purple-800'
      case 'DISABLED':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: SymptomStatus) => {
    switch (status) {
      case 'BASE':
        return 'Base (unmodified)'
      case 'MODIFIED':
        return 'Modified locally'
      case 'LOCAL_ONLY':
        return 'Local only'
      case 'DISABLED':
        return 'Disabled'
      default:
        return status
    }
  }

  // Filter symptoms by search query
  const filteredInUseSymptoms = libraryData?.inUse.filter(symptom =>
    symptom.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  const filteredAvailableSymptoms = libraryData?.available.filter(symptom =>
    symptom.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  const filteredCustomSymptoms = libraryData?.customOnly.filter(symptom =>
    symptom.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  if (loading && !libraryData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nhs-blue"></div>
      </div>
    )
  }

  if (!libraryData) {
    return (
      <div className="p-6 text-gray-600">
        Select a surgery to view its symptom library
      </div>
    )
  }

  // Button style classes
  const buttonBase = 'px-3 py-1 rounded-md text-sm font-medium transition-colors'
  const buttonRed = `${buttonBase} bg-red-600 text-white hover:bg-red-700`
  const buttonBlue = `${buttonBase} border border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white`
  const buttonGray = `${buttonBase} border border-gray-300 text-gray-700 hover:bg-gray-50`

  return (
    <div className="space-y-6">
      {/* Management bar */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-sm text-gray-700">
          {isSuperuser ? (
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Managing:</span>
              <select
                className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                value={currentSurgeryId || ''}
                onChange={(e) => setCurrentSurgeryId(e.target.value)}
              >
                {surgeries.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <span>Managing: this surgery</span>
          )}
        </div>
        <div>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 rounded-md text-sm font-medium bg-nhs-green text-white hover:bg-green-600"
            disabled={!currentSurgeryId && !isSuperuser}
          >
            Add Symptom
          </button>
        </div>
      </div>
      {/* Intro text */}
      <p className="text-sm text-gray-600 mb-4">
        This page controls which symptoms your reception/admin team can use, and whether they use the standard wording or a customised local version.
      </p>

      {/* In use at your surgery */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-2">In use at your surgery</h2>
        <p className="text-sm text-gray-600 mb-4">
          These symptoms are currently available to your reception/admin team. You can disable them, or if they were customised locally you can revert them back to the standard wording.
        </p>
        
        {libraryData.inUse.length === 0 ? (
          <p className="text-gray-600 italic">No symptoms currently in use</p>
        ) : (
          <>
            <div className="flex justify-end mb-3">
              <input
                type="text"
                placeholder="Search symptoms..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="overflow-x-auto rounded-md border border-gray-200 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-[40%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Symptom
                    </th>
                    <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Visible to reception?
                    </th>
                    <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last changed
                    </th>
                    <th className="w-[10%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInUseSymptoms.map((symptom) => (
                    <tr key={symptom.symptomId}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {symptom.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(symptom.status)}`}>
                          {getStatusLabel(symptom.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {symptom.isEnabled ? 'Yes' : 'No'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatLastEdited(symptom.lastEditedAt, symptom.lastEditedBy)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              // Determine if this is a base or custom symptom
                              const isBase = symptom.status !== 'LOCAL_ONLY'
                              handlePreview(isBase 
                                ? { baseSymptomId: symptom.symptomId }
                                : { customSymptomId: symptom.symptomId }
                              )
                            }}
                            className={buttonGray}
                            disabled={loading}
                          >
                            View
                          </button>
                          {symptom.isEnabled ? (
                            <button
                              onClick={() => handleAction('DISABLE', { 
                                statusRowId: symptom.statusRowId,
                                baseSymptomId: symptom.statusRowId ? undefined : symptom.symptomId
                              })}
                              className={buttonRed}
                              disabled={loading}
                            >
                              Disable
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAction('ENABLE_EXISTING', { 
                                statusRowId: symptom.statusRowId,
                                baseSymptomId: symptom.statusRowId ? undefined : symptom.symptomId
                              })}
                              className={buttonBlue}
                              disabled={loading}
                            >
                              Enable
                            </button>
                          )}
                          {symptom.canRevertToBase && (
                            <button
                              onClick={() => handleAction('REVERT_TO_BASE', { statusRowId: symptom.statusRowId })}
                              className={buttonBlue}
                              disabled={loading}
                            >
                              Revert to standard wording
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Available but not currently in use */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mt-8 mb-2">Available but not currently in use</h2>
        <p className="text-sm text-gray-600 mb-4">
          These are standard symptoms in the shared library. You can make them available to your team.
        </p>
        {libraryData.available.length > 0 && (
          <div className="mb-4">
            <button
              onClick={handleEnableAllBase}
              className="px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              disabled={loading}
            >
              Enable all standard symptoms for this surgery
            </button>
          </div>
        )}
        
        {libraryData.available.length === 0 ? (
          <p className="text-gray-600 italic">All available symptoms are already in use</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-[70%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symptom
                  </th>
                  <th className="w-[30%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAvailableSymptoms.map((symptom) => (
                  <tr key={symptom.baseSymptomId}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {symptom.name}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <button
                          onClick={() => handlePreview({ baseSymptomId: symptom.baseSymptomId })}
                          className={buttonGray}
                          disabled={loading}
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => handleAction('ENABLE_BASE', { baseSymptomId: symptom.baseSymptomId })}
                          className={buttonBlue}
                          disabled={loading}
                        >
                          Enable at this surgery
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Your custom symptoms */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mt-8 mb-2">Your custom-only symptoms</h2>
        <p className="text-sm text-gray-600 mb-4">
          These symptoms were created just for this surgery. They do not come from the standard shared library.
        </p>
        
        {libraryData.customOnly.length === 0 ? (
          <p className="text-gray-600 italic">No custom-only symptoms</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-[50%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symptom
                  </th>
                  <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Visible to reception?
                  </th>
                  <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last changed
                  </th>
                  <th className="w-[10%] px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomSymptoms.map((symptom) => {
                  const inUseEntry = libraryData.inUse.find(s => s.symptomId === symptom.customSymptomId)
                  return (
                    <tr key={symptom.customSymptomId}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {symptom.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {symptom.isEnabled ? 'Yes' : 'No'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {inUseEntry ? formatLastEdited(inUseEntry.lastEditedAt, inUseEntry.lastEditedBy) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <button
                            onClick={() => handlePreview({ customSymptomId: symptom.customSymptomId })}
                            className={buttonGray}
                            disabled={loading}
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleAction(symptom.isEnabled ? 'DISABLE' : 'ENABLE_EXISTING', { 
                              statusRowId: inUseEntry?.statusRowId 
                            })}
                            className={symptom.isEnabled ? buttonRed : buttonBlue}
                            disabled={loading}
                          >
                            {symptom.isEnabled ? 'Disable' : 'Enable'}
                          </button>
                          {isSuperuser && (
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch('/api/symptoms/promote', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ customSymptomId: symptom.customSymptomId })
                                  })
                                  const data = await res.json().catch(() => ({}))
                                  if (!res.ok) {
                                    toast.error(data.error || 'Promote failed')
                                    return
                                  }
                                  toast.success('Promoted to Base')
                                  loadLibraryData()
                                } catch (e) {
                                  console.error(e)
                                  toast.error('Promote failed')
                                }
                              }}
                              className={buttonBlue}
                              disabled={loading}
                            >
                              Promote to Base
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

      {/* Preview modal */}
      {currentSurgeryId && (
        <SymptomPreviewModal
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          surgeryId={currentSurgeryId}
          baseSymptomId={previewIds?.baseSymptomId}
          customSymptomId={previewIds?.customSymptomId}
          onRefetch={loadLibraryData}
        />
      )}

      {/* New Symptom modal */}
      {showNewModal && (
        <NewSymptomModal
          isOpen={showNewModal}
          onClose={() => setShowNewModal(false)}
          isSuperuser={isSuperuser}
          currentSurgeryId={currentSurgeryId}
          surgeries={surgeries}
          onCreated={(scope) => {
            if (scope === 'BASE') {
              toast.success('Created in Base. Practices can enable it from Available.')
            } else {
              toast.success('Created for this surgery and made visible to reception.')
            }
            loadLibraryData()
          }}
        />
      )}
    </div>
  )
}

