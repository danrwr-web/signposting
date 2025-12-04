'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import SimpleHeader from '@/components/SimpleHeader'
import { SessionUser } from '@/lib/rbac'
import { EffectiveSymptom } from '@/lib/api-contracts'
import Link from 'next/link'

interface AISetupClientProps {
  surgeryId: string
  surgeryName: string
  onboardingCompleted: boolean
  featureEnabled: boolean
  user: SessionUser
}

type CustomiseScope = 'all' | 'core' | 'manual'

export default function AISetupClient({
  surgeryId,
  surgeryName,
  onboardingCompleted,
  featureEnabled,
  user,
}: AISetupClientProps) {
  const router = useRouter()
  const [scope, setScope] = useState<CustomiseScope>('core')
  const [selectedSymptomIds, setSelectedSymptomIds] = useState<string[]>([])
  const [symptoms, setSymptoms] = useState<EffectiveSymptom[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState<{
    current: number
    total: number
    processedCount: number
    skippedCount: number
  } | null>(null)
  const [result, setResult] = useState<{
    processedCount: number
    skippedCount: number
    message: string
  } | null>(null)

  // Load symptoms for manual selection
  useEffect(() => {
    if (scope === 'manual' && symptoms.length === 0) {
      loadSymptoms()
    }
  }, [scope])

  const loadSymptoms = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/symptoms?surgeryId=${surgeryId}`)
      if (response.ok) {
        const data = await response.json()
        setSymptoms(data.symptoms || [])
      } else {
        toast.error('Failed to load symptoms')
      }
    } catch (error) {
      console.error('Error loading symptoms:', error)
      toast.error('Failed to load symptoms')
    } finally {
      setLoading(false)
    }
  }

  const handleCustomise = async () => {
    if (scope === 'manual' && selectedSymptomIds.length === 0) {
      toast.error('Please select at least one symptom')
      return
    }

    try {
      setProcessing(true)
      setResult(null)
      setProcessingProgress(null)

      // For manual scope, process one by one
      if (scope === 'manual') {
        let cumulativeProcessed = 0
        let cumulativeSkipped = 0
        const total = selectedSymptomIds.length

        for (let i = 0; i < selectedSymptomIds.length; i++) {
          const symptomId = selectedSymptomIds[i]
          setProcessingProgress({
            current: i + 1,
            total,
            processedCount: cumulativeProcessed,
            skippedCount: cumulativeSkipped,
          })

          try {
            const response = await fetch(
              `/api/surgeries/${surgeryId}/ai/customise-instructions`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  scope: 'manual' as const,
                  symptomIds: [symptomId],
                }),
              }
            )

            if (response.ok) {
              const data = await response.json()
              cumulativeProcessed += data.processedCount
              cumulativeSkipped += data.skippedCount
            } else {
              const errorData = await response.json()
              console.error(`Error processing symptom ${symptomId}:`, errorData.error)
              cumulativeSkipped++
            }
          } catch (error) {
            console.error(`Error processing symptom ${symptomId}:`, error)
            cumulativeSkipped++
          }
        }

        // Show final results
        setProcessingProgress(null)
        setResult({
          processedCount: cumulativeProcessed,
          skippedCount: cumulativeSkipped,
          message: `Successfully customised ${cumulativeProcessed} symptom${cumulativeProcessed !== 1 ? 's' : ''}. ${cumulativeSkipped > 0 ? `${cumulativeSkipped} skipped.` : ''}`,
        })
        toast.success(
          `Customisation completed: ${cumulativeProcessed} processed, ${cumulativeSkipped} skipped`
        )
      } else {
        // For 'all' and 'core', use single API call
        const body: {
          scope: CustomiseScope
          symptomIds?: string[]
        } = {
          scope,
        }

        const response = await fetch(
          `/api/surgeries/${surgeryId}/ai/customise-instructions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to customise instructions')
        }

        const data = await response.json()
        setResult(data)
        toast.success(data.message || 'Customisation completed successfully')
      }
    } catch (error) {
      console.error('Error customising instructions:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to customise instructions'
      )
      setProcessingProgress(null)
    } finally {
      setProcessing(false)
    }
  }

  const toggleSymptom = (symptomId: string) => {
    setSelectedSymptomIds((prev) =>
      prev.includes(symptomId)
        ? prev.filter((id) => id !== symptomId)
        : [...prev, symptomId]
    )
  }

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader title="AI Surgery Customisation" />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-nhs-dark-blue mb-2">
            AI Surgery-Specific Customisation
          </h1>
          <p className="text-gray-600 mb-6">
            Use AI to rewrite symptom instructions based on your surgery&apos;s
            onboarding profile. All changes require clinical review before
            becoming visible to staff.
          </p>

          {/* Onboarding Status */}
          {!onboardingCompleted && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-yellow-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>Onboarding incomplete.</strong> Please complete the
                    onboarding questionnaire before using AI customisation.{' '}
                    <Link
                      href={`/s/${surgeryId}/admin/onboarding`}
                      className="underline font-medium"
                    >
                      Complete onboarding →
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Feature Flag Status */}
          {!featureEnabled && (
            <div className="bg-gray-50 border-l-4 border-gray-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-gray-700">
                    <strong>AI customisation disabled for this surgery.</strong>{' '}
                    Contact a superuser to enable this feature.
                  </p>
                </div>
              </div>
            </div>
          )}

              {/* Scope Selection */}
              {onboardingCompleted && featureEnabled && (
                <>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Customisation Scope
                    </label>
                    <div className="space-y-3">
                  <label className="flex items-start">
                    <input
                      type="radio"
                      name="scope"
                      value="all"
                      checked={scope === 'all'}
                      onChange={(e) => setScope(e.target.value as CustomiseScope)}
                      disabled={processing}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900">
                        Customise ALL symptoms
                      </div>
                      <div className="text-sm text-gray-500">
                        Process all symptoms available for this surgery
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start">
                    <input
                      type="radio"
                      name="scope"
                      value="core"
                      checked={scope === 'core'}
                      onChange={(e) => setScope(e.target.value as CustomiseScope)}
                      disabled={processing}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900">
                        Customise CORE set only
                      </div>
                      <div className="text-sm text-gray-500">
                        Process commonly used symptoms (currently same as all)
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start">
                    <input
                      type="radio"
                      name="scope"
                      value="manual"
                      checked={scope === 'manual'}
                      onChange={(e) => setScope(e.target.value as CustomiseScope)}
                      disabled={processing}
                      className="mt-1 mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900">
                        Select symptoms manually
                      </div>
                      <div className="text-sm text-gray-500">
                        Choose specific symptoms to customise
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Manual Symptom Selection */}
              {scope === 'manual' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Symptoms ({selectedSymptomIds.length} selected)
                  </label>
                  {loading ? (
                    <div className="text-center py-8 text-gray-500">
                      Loading symptoms...
                    </div>
                  ) : (
                    <div className="border border-gray-300 rounded-lg max-h-96 overflow-y-auto">
                      <div className="p-4 space-y-2">
                        {symptoms.map((symptom) => (
                          <label
                            key={symptom.id}
                            className="flex items-start cursor-pointer hover:bg-gray-50 p-2 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={selectedSymptomIds.includes(symptom.id)}
                              onChange={() => toggleSymptom(symptom.id)}
                              disabled={processing}
                              className="mt-1 mr-3"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {symptom.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {symptom.ageGroup} •{' '}
                                {symptom.briefInstruction || 'No brief instruction'}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Processing Progress */}
              {processingProgress && (
                <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg
                        className="animate-spin h-5 w-5 text-blue-400"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-blue-800">
                        Processing {processingProgress.current} of{' '}
                        {processingProgress.total} symptoms...
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        Processed: {processingProgress.processedCount} • Skipped:{' '}
                        {processingProgress.skippedCount}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="mb-6">
                <button
                  onClick={handleCustomise}
                  disabled={
                    processing ||
                    (scope === 'manual' && selectedSymptomIds.length === 0)
                  }
                  className="w-full bg-nhs-blue text-white px-6 py-3 rounded-lg font-medium hover:bg-nhs-dark-blue disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {processing && !processingProgress
                    ? 'Generating AI-customised instructions...'
                    : processing && processingProgress
                    ? `Processing ${processingProgress.current} of ${processingProgress.total}...`
                    : 'Generate AI-customised instructions'}
                </button>
              </div>

              {/* Results */}
              {result && (
                <div className="bg-green-50 border-l-4 border-green-400 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-green-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">
                        {result.message}
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        Processed: {result.processedCount} • Skipped:{' '}
                        {result.skippedCount}
                      </p>
                      <p className="text-sm text-green-700 mt-2">
                        All customised symptoms are now pending clinical review.
                        Visit the{' '}
                        <Link
                          href={`/s/${surgeryId}/clinical-review`}
                          className="underline font-medium"
                        >
                          Clinical Review
                        </Link>{' '}
                        page to approve them.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

