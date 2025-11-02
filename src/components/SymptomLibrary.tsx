'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'

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

  const loadLibraryData = async () => {
    if (!surgeryId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/surgerySymptoms?surgeryId=${surgeryId}`, {
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
    if (surgeryId) {
      loadLibraryData()
    }
  }, [surgeryId])

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

  return (
    <div className="space-y-6">
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symptom
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Visible to reception?
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last changed
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {libraryData.inUse.map((symptom) => (
                  <tr key={symptom.symptomId}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {symptom.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(symptom.status)}`}>
                        {getStatusLabel(symptom.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {symptom.isEnabled ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {formatLastEdited(symptom.lastEditedAt, symptom.lastEditedBy)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-2">
                        {symptom.isEnabled ? (
                          <button
                            onClick={() => handleAction('DISABLE', { statusRowId: symptom.statusRowId })}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                            disabled={loading}
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAction('ENABLE_EXISTING', { statusRowId: symptom.statusRowId })}
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                            disabled={loading}
                          >
                            Enable
                          </button>
                        )}
                        {symptom.canRevertToBase && (
                          <button
                            onClick={() => handleAction('REVERT_TO_BASE', { statusRowId: symptom.statusRowId })}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symptom
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {libraryData.available.map((symptom) => (
                  <tr key={symptom.baseSymptomId}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {symptom.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleAction('ENABLE_BASE', { baseSymptomId: symptom.baseSymptomId })}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                        disabled={loading}
                      >
                        Enable at this surgery
                      </button>
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symptom
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Visible to reception?
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last changed
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {libraryData.customOnly.map((symptom) => {
                  const inUseEntry = libraryData.inUse.find(s => s.symptomId === symptom.customSymptomId)
                  return (
                    <tr key={symptom.customSymptomId}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {symptom.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {symptom.isEnabled ? 'Yes' : 'No'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {inUseEntry ? formatLastEdited(inUseEntry.lastEditedAt, inUseEntry.lastEditedBy) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleAction(symptom.isEnabled ? 'DISABLE' : 'ENABLE_EXISTING', { 
                            statusRowId: inUseEntry?.statusRowId 
                          })}
                          className={`px-3 py-1 rounded hover:opacity-80 transition-colors text-sm ${
                            symptom.isEnabled 
                              ? 'bg-red-600 text-white' 
                              : 'bg-green-600 text-white'
                          }`}
                          disabled={loading}
                        >
                          {symptom.isEnabled ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

