'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SessionUser } from '@/lib/rbac'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import { toast } from 'react-hot-toast'

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

interface ClinicalReviewClientProps {
  surgery: Surgery
  symptoms: EffectiveSymptom[]
  reviewStatuses: SymptomReviewStatus[]
  user: SessionUser
}

export default function ClinicalReviewClient({
  surgery,
  symptoms,
  reviewStatuses: initialReviewStatuses,
  user
}: ClinicalReviewClientProps) {
  const [reviewStatuses, setReviewStatuses] = useState<Map<string, SymptomReviewStatus>>(
    new Map(initialReviewStatuses.map(rs => [`${rs.symptomId}-${rs.ageGroup || ''}`, rs]))
  )
  const [loading, setLoading] = useState<string | null>(null)
  const [surgeryData, setSurgeryData] = useState(surgery)

  // Calculate statistics
  const totalSymptoms = symptoms.length
  const approvedCount = Array.from(reviewStatuses.values()).filter(rs => rs.status === 'APPROVED').length
  const changesRequiredCount = Array.from(reviewStatuses.values()).filter(rs => rs.status === 'CHANGES_REQUIRED').length
  
  // Count pending: symptoms that don't have a review status OR have PENDING status
  const reviewedSymptomKeys = new Set(reviewStatuses.keys())
  const unreviewedCount = symptoms.filter(s => {
    const key = `${s.id}-${s.ageGroup || ''}`
    return !reviewedSymptomKeys.has(key)
  }).length
  const explicitPendingCount = Array.from(reviewStatuses.values()).filter(rs => rs.status === 'PENDING').length
  const pendingCount = unreviewedCount + explicitPendingCount

  const getReviewStatus = (symptomId: string, ageGroup: string | null): SymptomReviewStatus | null => {
    return reviewStatuses.get(`${symptomId}-${ageGroup || ''}`) || null
  }

  const updateReviewStatus = async (symptomId: string, ageGroup: string | null, newStatus: 'PENDING' | 'APPROVED' | 'CHANGES_REQUIRED') => {
    const key = `${symptomId}-${ageGroup || ''}`
    setLoading(key)

    try {
      const response = await fetch('/api/admin/review-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          surgeryId: surgery.id,
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
      
      // Update local state
      setReviewStatuses(prev => {
        const next = new Map(prev)
        next.set(key, updatedStatus)
        return next
      })

      toast.success(`Symptom marked as ${newStatus === 'APPROVED' ? 'Approved' : 'Needs Change'}`)
    } catch (error) {
      console.error('Error updating review status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update review status')
    } finally {
      setLoading(null)
    }
  }

  const handleCompleteReview = async () => {
    if (!confirm('Are you sure you want to complete the clinical review and sign off? This will mark the surgery as clinically reviewed.')) {
      return
    }

    setLoading('complete')

    try {
      const response = await fetch('/api/admin/complete-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          surgeryId: surgery.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to complete review')
      }

      const result = await response.json()
      setSurgeryData(result.surgery)
      
      toast.success('Clinical review completed and signed off successfully!')
      
      // Refresh the page after a short delay to show the updated status
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      console.error('Error completing review:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to complete review')
    } finally {
      setLoading(null)
    }
  }

  const handleRequestRereview = async () => {
    if (!confirm('Are you sure you want to request a re-review? This will reset all symptoms to pending status.')) {
      return
    }

    setLoading('rereview')

    try {
      const response = await fetch('/api/admin/request-rereview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          surgeryId: surgery.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to request re-review')
      }

      toast.success('Re-review requested. All symptoms are now marked as pending.')
      
      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      console.error('Error requesting re-review:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to request re-review')
    } finally {
      setLoading(null)
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link
                href={`/admin`}
                className="text-blue-600 hover:text-blue-500 mr-4"
              >
                ← Back to Admin Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                Clinical Review - {surgery.name}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Summary */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Review Status Summary
          </h2>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-gray-500">Total Symptoms</div>
              <div className="text-2xl font-bold text-gray-900">{totalSymptoms}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-green-700">Approved</div>
              <div className="text-2xl font-bold text-green-900">{approvedCount}</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-yellow-700">Pending</div>
              <div className="text-2xl font-bold text-yellow-900">{pendingCount}</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-sm font-medium text-red-700">Needs Change</div>
              <div className="text-2xl font-bold text-red-900">{changesRequiredCount}</div>
            </div>
          </div>

          <div className="border-t pt-4">
            {surgeryData.requiresClinicalReview ? (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                <p className="text-sm font-medium text-yellow-800">
                  <strong>Current status:</strong> Awaiting Clinical Sign-off
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  {pendingCount} symptom{pendingCount !== 1 ? 's' : ''} still need{pendingCount === 1 ? 's' : ''} to be reviewed.
                </p>
              </div>
            ) : (
              <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
                <p className="text-sm font-medium text-green-800">
                  <strong>Current status:</strong> Signed Off
                </p>
                {surgeryData.lastClinicalReviewAt && surgeryData.lastClinicalReviewer && (
                  <p className="text-sm text-green-700 mt-1">
                    Signed off on {formatDate(surgeryData.lastClinicalReviewAt)} by{' '}
                    {surgeryData.lastClinicalReviewer.name || surgeryData.lastClinicalReviewer.email}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-3">
            {!surgeryData.requiresClinicalReview && (
              <button
                onClick={handleRequestRereview}
                disabled={loading === 'rereview'}
                className="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-300 rounded-md hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === 'rereview' ? 'Requesting...' : 'Request Re-review'}
              </button>
            )}
            
            {surgeryData.requiresClinicalReview && (
              <button
                onClick={handleCompleteReview}
                disabled={loading === 'complete' || pendingCount > 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading === 'complete' ? 'Completing...' : 'Complete Review and Sign Off'}
              </button>
            )}
            
            {pendingCount > 0 && surgeryData.requiresClinicalReview && (
              <p className="text-sm text-gray-600 mt-2">
                You must review all {pendingCount} pending symptom{pendingCount !== 1 ? 's' : ''} before completing the review.
              </p>
            )}
          </div>
        </div>

        {/* Symptoms Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Symptoms Review List
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Review each symptom and mark it as Approved or Needs Change.
            </p>
          </div>

          <div className="overflow-x-auto md:overflow-x-visible">
            <table className="min-w-full table-fixed divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5 md:w-2/5 break-words">
                    Symptom Name
                  </th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6 md:w-1/6">
                    Age Group
                  </th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6 md:w-1/6">
                    Status
                  </th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6 md:w-1/6">
                    Last Reviewed
                  </th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5 md:w-2/5">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {symptoms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 md:px-6 py-4 text-center text-sm text-gray-500">
                      No symptoms found for this surgery.
                    </td>
                  </tr>
                ) : (
                  symptoms.map((symptom) => {
                    const reviewStatus = getReviewStatus(symptom.id, symptom.ageGroup)
                    const status = reviewStatus?.status || 'PENDING'
                    const key = `${symptom.id}-${symptom.ageGroup || ''}`

                    return (
                      <tr key={symptom.id} className="align-top">
                        <td className="px-4 md:px-6 py-4 whitespace-normal break-words">
                          <div className="text-sm font-medium text-gray-900 leading-snug">
                            {symptom.name}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500">
                            {symptom.ageGroup || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(status)}`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-normal break-words text-sm text-gray-500">
                          {reviewStatus?.lastReviewedAt ? (
                            <div>
                              <div>{formatDate(reviewStatus.lastReviewedAt)}</div>
                              {reviewStatus.lastReviewedBy && (
                                <div className="text-xs text-gray-400">
                                  by {reviewStatus.lastReviewedBy.name || reviewStatus.lastReviewedBy.email}
                                </div>
                              )}
                            </div>
                          ) : (
                            'Not reviewed'
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-4 whitespace-normal break-words text-sm font-medium">
                          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-2 md:space-y-0">
                            <Link
                              href={`/symptom/${symptom.id}?surgery=${surgery.id}&ref=clinical-review`}
                              className="text-blue-600 hover:text-blue-900"
                              target="_blank"
                            >
                              View / Edit
                            </Link>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <label className="inline-flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={status === 'APPROVED'}
                                  onChange={() => {
                                    // If already approved, uncheck (set to PENDING)
                                    // Otherwise, set to approved
                                    const newStatus: 'PENDING' | 'APPROVED' | 'CHANGES_REQUIRED' = status === 'APPROVED' ? 'PENDING' : 'APPROVED'
                                    updateReviewStatus(symptom.id, symptom.ageGroup || null, newStatus)
                                  }}
                                  disabled={loading === key}
                                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <span className="text-green-700 font-medium">Approved</span>
                              </label>
                              <label className="inline-flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={status === 'CHANGES_REQUIRED'}
                                  onChange={() => {
                                    // If already needs change, uncheck (set to PENDING)
                                    // Otherwise, set to needs change
                                    const newStatus: 'PENDING' | 'APPROVED' | 'CHANGES_REQUIRED' = status === 'CHANGES_REQUIRED' ? 'PENDING' : 'CHANGES_REQUIRED'
                                    updateReviewStatus(symptom.id, symptom.ageGroup || null, newStatus)
                                  }}
                                  disabled={loading === key}
                                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <span className="text-red-700 font-medium">Needs Change</span>
                              </label>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

