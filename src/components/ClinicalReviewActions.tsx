'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'

interface ClinicalReviewActionsProps {
  surgeryId: string
  symptomId: string
  ageGroup?: string | null
  symptomSource?: 'base' | 'custom' | 'override'
  baseSymptomId?: string | null
}

export default function ClinicalReviewActions({ surgeryId, symptomId, ageGroup, symptomSource, baseSymptomId }: ClinicalReviewActionsProps) {
  const [loading, setLoading] = useState<'PENDING' | 'APPROVED' | 'CHANGES_REQUIRED' | null>(null)
  const [showRequestChangesDialog, setShowRequestChangesDialog] = useState(false)
  const [changeRequestNote, setChangeRequestNote] = useState('')
  const router = useRouter()

  const updateStatus = async (newStatus: 'PENDING' | 'APPROVED' | 'CHANGES_REQUIRED', alsoDisable?: boolean, note?: string) => {
    try {
      setLoading(newStatus)
      const res = await fetch('/api/admin/review-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          surgeryId, 
          symptomId, 
          ageGroup: ageGroup || null, 
          newStatus,
          reviewNote: note || undefined
        })
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Failed to update review status')
      }

      // If also disabling, call the surgerySymptoms API
      if (alsoDisable && newStatus === 'CHANGES_REQUIRED') {
        try {
          const disableBody: any = {
            action: 'DISABLE',
            surgeryId,
          }
          
          if (symptomSource === 'base' || symptomSource === 'override') {
            disableBody.baseSymptomId = baseSymptomId || symptomId
          } else if (symptomSource === 'custom') {
            disableBody.customSymptomId = symptomId
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

      toast.success(
        newStatus === 'APPROVED' ? 'Marked Approved' : newStatus === 'CHANGES_REQUIRED' ? 'Changes requested' : 'Set to Pending'
      )
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update review status')
    } finally {
      setLoading(null)
      setShowRequestChangesDialog(false)
      setChangeRequestNote('')
    }
  }

  const handleRequestChanges = () => {
    setShowRequestChangesDialog(true)
  }

  return (
    <>
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-end gap-3">
          <button
            onClick={() => updateStatus('PENDING')}
            disabled={loading !== null}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'PENDING' ? 'Saving…' : 'Set Pending'}
          </button>
          <button
            onClick={handleRequestChanges}
            disabled={loading !== null}
            className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Request changes
          </button>
          <button
            onClick={() => updateStatus('APPROVED')}
            disabled={loading !== null}
            className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'APPROVED' ? 'Saving…' : 'Mark Approved'}
          </button>
        </div>
      </div>

      {/* Request Changes Dialog */}
      {showRequestChangesDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
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
                  updateStatus('CHANGES_REQUIRED', false, changeRequestNote?.trim() || undefined)
                }}
                disabled={loading !== null}
                className="px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                Request changes only
              </button>
              <button
                onClick={() => {
                  updateStatus('CHANGES_REQUIRED', true, changeRequestNote?.trim() || undefined)
                }}
                disabled={loading !== null}
                className="px-4 py-2 rounded-md text-sm font-medium bg-red-700 text-white hover:bg-red-800 disabled:opacity-50"
              >
                Request changes and disable
              </button>
              <button
                onClick={() => {
                  setShowRequestChangesDialog(false)
                  setChangeRequestNote('')
                }}
                className="px-4 py-2 rounded-md text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


