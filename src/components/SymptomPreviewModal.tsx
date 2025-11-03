'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'

interface SymptomPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  surgeryId: string
  baseSymptomId?: string
  customSymptomId?: string
  onRefetch?: () => void
}

interface SymptomPreviewData {
  name: string
  status: 'BASE' | 'MODIFIED' | 'LOCAL_ONLY'
  isEnabled: boolean
  canEnable: boolean
  lastEditedBy?: string | null
  lastEditedAt?: string | null
  briefInstruction?: string | null
  instructionsHtml?: string | null
  baseInstructionsHtml?: string | null
}

export default function SymptomPreviewModal({
  isOpen,
  onClose,
  surgeryId,
  baseSymptomId,
  customSymptomId,
  onRefetch
}: SymptomPreviewModalProps) {
  const [previewData, setPreviewData] = useState<SymptomPreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'local' | 'base'>('local')

  // Fetch preview data when modal opens
  useEffect(() => {
    if (!isOpen || !surgeryId || (!baseSymptomId && !customSymptomId)) {
      setPreviewData(null)
      setViewMode('local')
      return
    }

    const fetchPreview = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ surgeryId })
        if (baseSymptomId) params.append('baseSymptomId', baseSymptomId)
        if (customSymptomId) params.append('customSymptomId', customSymptomId)

        const response = await fetch(`/api/symptomPreview?${params.toString()}`)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          toast.error(errorData.error || 'Failed to load preview')
          return
        }

        const data = await response.json()
        setPreviewData(data)
        // Reset view mode based on status
        setViewMode(data.status === 'MODIFIED' ? 'local' : 'local')
      } catch (error) {
        console.error('Error fetching preview:', error)
        toast.error('Failed to load preview')
      } finally {
        setLoading(false)
      }
    }

    fetchPreview()
  }, [isOpen, surgeryId, baseSymptomId, customSymptomId])

  const handleEnable = async () => {
    if (!previewData || !surgeryId) return

    setActionLoading(true)
    try {
      const response = await fetch('/api/surgerySymptoms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: baseSymptomId ? 'ENABLE_BASE' : 'ENABLE_EXISTING',
          surgeryId,
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
      if (onRefetch) {
        onRefetch()
      }
      onClose()
    } catch (error) {
      console.error('Error enabling symptom:', error)
      toast.error('Failed to enable symptom')
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusLabel = (status: 'BASE' | 'MODIFIED' | 'LOCAL_ONLY') => {
    switch (status) {
      case 'BASE':
        return 'Base (unmodified)'
      case 'MODIFIED':
        return 'Modified locally'
      case 'LOCAL_ONLY':
        return 'Local only'
    }
  }

  const getStatusBadgeColor = (status: 'BASE' | 'MODIFIED' | 'LOCAL_ONLY') => {
    switch (status) {
      case 'BASE':
        return 'bg-green-100 text-green-800'
      case 'MODIFIED':
        return 'bg-blue-100 text-blue-800'
      case 'LOCAL_ONLY':
        return 'bg-purple-100 text-purple-800'
    }
  }

  const formatLastEdited = (lastEditedAt?: string | null, lastEditedBy?: string | null) => {
    if (!lastEditedAt || !lastEditedBy) return '-'
    const date = new Date(lastEditedAt)
    return `${lastEditedBy} • ${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
  }

  if (!isOpen) return null

  const currentInstructionsHtml = 
    previewData?.status === 'MODIFIED' && viewMode === 'base'
      ? previewData.baseInstructionsHtml
      : previewData?.instructionsHtml

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 pt-6 pb-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                  {previewData?.name || 'Loading...'} — Preview (read-only)
                </h2>
                
                {previewData && (
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(previewData.status)}`}>
                      {getStatusLabel(previewData.status)}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Visible to reception: {previewData.isEnabled ? 'Yes' : 'No'}
                    </span>
                  </div>
                )}

                {previewData && (
                  <p className="text-sm text-gray-600">
                    Last changed: {formatLastEdited(previewData.lastEditedAt, previewData.lastEditedBy)}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="ml-4 text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white px-6 py-4 max-h-[calc(100vh-300px)] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : previewData ? (
              <div className="space-y-6">
                {/* Brief instruction */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Brief instruction</h3>
                  <p className="text-sm text-gray-700">
                    {previewData.briefInstruction || '—'}
                  </p>
                </div>

                {/* Full instruction */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">Full instruction</h3>
                    {previewData.status === 'MODIFIED' && previewData.baseInstructionsHtml && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setViewMode('local')}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                            viewMode === 'local'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          Local wording
                        </button>
                        <button
                          onClick={() => setViewMode('base')}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                            viewMode === 'base'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          Base wording
                        </button>
                      </div>
                    )}
                  </div>
                  {currentInstructionsHtml ? (
                    <div 
                      className="prose max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 [&_a]:pointer-events-none [&_a]:opacity-60 [&_a]:cursor-default"
                      dangerouslySetInnerHTML={{ __html: currentInstructionsHtml }}
                    />
                  ) : (
                    <p className="text-sm text-gray-700">—</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-600">No preview data available</p>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              disabled={actionLoading}
            >
              Close
            </button>
            {previewData && !previewData.isEnabled && previewData.canEnable && (
              <button
                onClick={handleEnable}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                disabled={actionLoading || loading}
              >
                {actionLoading ? 'Enabling...' : 'Enable at this surgery'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
