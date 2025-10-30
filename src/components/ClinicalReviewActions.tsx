'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'

interface ClinicalReviewActionsProps {
  surgeryId: string
  symptomId: string
  ageGroup?: string | null
}

export default function ClinicalReviewActions({ surgeryId, symptomId, ageGroup }: ClinicalReviewActionsProps) {
  const [loading, setLoading] = useState<'APPROVED' | 'CHANGES_REQUIRED' | null>(null)

  const updateStatus = async (newStatus: 'APPROVED' | 'CHANGES_REQUIRED') => {
    try {
      setLoading(newStatus)
      const res = await fetch('/api/admin/review-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surgeryId, symptomId, ageGroup: ageGroup || null, newStatus })
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Failed to update review status')
      }
      toast.success(newStatus === 'APPROVED' ? 'Marked Approved' : 'Marked Needs Change')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update review status')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-end gap-3">
        <button
          onClick={() => updateStatus('CHANGES_REQUIRED')}
          disabled={loading !== null}
          className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading === 'CHANGES_REQUIRED' ? 'Saving…' : 'Mark Needs Change'}
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
  )
}


