'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { SessionUser } from '@/lib/rbac'
import { EffectiveSymptom, AppointmentModelConfig } from '@/lib/api-contracts'
import Link from 'next/link'

interface AISetupClientProps {
  surgeryId: string
  surgeryName: string
  onboardingCompleted: boolean
  featureEnabled: boolean
  appointmentModel: AppointmentModelConfig
  user: SessionUser
}

type CustomiseScope = 'all' | 'core' | 'manual'

interface CustomiseInstructionsResponse {
  processedCount: number
  skippedCount: number
  message: string
  skippedDetails?: Array<{ symptomId: string; reason?: string }>
}

const APPOINTMENT_ARCHETYPE_LABELS: Record<Exclude<keyof AppointmentModelConfig, 'clinicianArchetypes'>, string> = {
  routineContinuityGp: 'Routine continuity GP',
  routineGpPhone: 'Routine GP telephone',
  gpTriage48h: 'GP triage within 48 hours',
  urgentSameDayPhone: 'Urgent same-day telephone (Duty GP)',
  urgentSameDayF2F: 'Urgent same-day face-to-face',
  otherClinicianDirect: 'Direct booking with another clinician',
}

export default function AISetupClient({
  surgeryId,
  surgeryName,
  onboardingCompleted,
  featureEnabled,
  appointmentModel,
  user,
}: AISetupClientProps) {
  const router = useRouter()
  const [scope, setScope] = useState<CustomiseScope>('all')
  const [selectedSymptomIds, setSelectedSymptomIds] = useState<string[]>([])
  const [symptoms, setSymptoms] = useState<EffectiveSymptom[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [processingProgress, setProcessingProgress] = useState<{
    current: number
    total: number
    processedCount: number
    skippedCount: number
    currentSymptomName?: string
  } | null>(null)
  const [result, setResult] = useState<{
    processedCount: number
    skippedCount: number
    message: string
    skippedDetails?: Array<{ symptomId: string; reason?: string }>
  } | null>(null)

  // Load symptoms for manual selection and ALL mode
  useEffect(() => {
    if ((scope === 'manual' || scope === 'all') && symptoms.length === 0) {
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

  // Helper function to process symptom IDs one by one
  const processSymptomIds = async (symptomIds: string[]) => {
    let cumulativeProcessed = 0
    let cumulativeSkipped = 0
    const skippedDetails: Array<{ symptomId: string; reason?: string }> = []
    const total = symptomIds.length

    for (let i = 0; i < symptomIds.length; i++) {
      const symptomId = symptomIds[i]
      const symptom = symptoms.find(s => s.id === symptomId)
      const symptomName = symptom?.name || `Symptom ${i + 1}`

      setProcessingProgress({
        current: i + 1,
        total,
        processedCount: cumulativeProcessed,
        skippedCount: cumulativeSkipped,
        currentSymptomName: symptomName,
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
          const data: CustomiseInstructionsResponse = await response.json()
          cumulativeProcessed += data.processedCount || 0
          cumulativeSkipped += data.skippedCount || 0
          // Accumulate skipped details for this symptom if it was skipped
          if (data.skippedCount > 0 && data.skippedDetails && data.skippedDetails.length > 0) {
            skippedDetails.push(...data.skippedDetails)
          }
        } else {
          const errorData = await response.json()
          console.error(`Error processing symptom ${symptomId}:`, errorData.error)
          cumulativeSkipped++
          skippedDetails.push({ symptomId, reason: errorData.error || 'Request failed' })
        }
      } catch (error) {
        console.error(`Error processing symptom ${symptomId}:`, error)
        cumulativeSkipped++
        skippedDetails.push({ 
          symptomId, 
          reason: error instanceof Error ? error.message : 'Network error' 
        })
      }
    }

    return {
      processedCount: cumulativeProcessed,
      skippedCount: cumulativeSkipped,
      skippedDetails,
    }
  }

  const handleCustomise = async () => {
    if (scope === 'manual' && selectedSymptomIds.length === 0) {
      toast.error('Please select at least one symptom')
      return
    }

    if (scope === 'all' && symptoms.length === 0) {
      toast.error('Please wait for symptoms to load')
      return
    }

    try {
      setProcessing(true)
      setResult(null)
      setProcessingProgress(null)

      let symptomIdsToProcess: string[]
      
      if (scope === 'manual') {
        symptomIdsToProcess = selectedSymptomIds
      } else {
        // For 'all', use all available symptom IDs
        symptomIdsToProcess = symptoms.map(s => s.id)
      }

      const results = await processSymptomIds(symptomIdsToProcess)

      // Show final results
      setProcessingProgress(null)
      setResult({
        processedCount: results.processedCount,
        skippedCount: results.skippedCount,
        message: `Successfully customised ${results.processedCount} symptom${results.processedCount !== 1 ? 's' : ''}. ${results.skippedCount > 0 ? `${results.skippedCount} skipped.` : ''}`,
        skippedDetails: results.skippedDetails,
      })
      toast.success(
        `Customisation completed: ${results.processedCount} processed, ${results.skippedCount} skipped`
      )
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-4">
          <Link
            href={`/s/${surgeryId}/admin/setup-checklist`}
            className="inline-flex items-center text-sm text-nhs-blue hover:text-nhs-dark-blue"
          >
            &larr; Back to Setup Checklist
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-nhs-dark-blue mb-2">
            AI Surgery-Specific Customisation (Beta)
          </h1>
          <p className="text-sm text-gray-600 mb-2">
            This is a beta feature. It helps rewrite instructions for your surgery, but all changes must be clinically reviewed and approved before use.
          </p>
          <p className="text-gray-600 mb-6">
            Use AI to rewrite symptom instructions based on your surgery&apos;s
            onboarding profile. All changes require clinical review before
            becoming visible to staff.
          </p>

          {/* Appointment Model Summary */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-nhs-dark-blue mb-4">
              Appointment model for this surgery
            </h2>
            {(() => {
              const gpArchetypesEnabled = Object.values({
                routineContinuityGp: appointmentModel.routineContinuityGp,
                routineGpPhone: appointmentModel.routineGpPhone,
                gpTriage48h: appointmentModel.gpTriage48h,
                urgentSameDayPhone: appointmentModel.urgentSameDayPhone,
                urgentSameDayF2F: appointmentModel.urgentSameDayF2F,
                otherClinicianDirect: appointmentModel.otherClinicianDirect,
              }).some((arch) => arch.enabled)
              const clinicianArchetypesEnabled = (appointmentModel.clinicianArchetypes || []).some((ca) => ca.enabled)
              const hasAnyEnabled = gpArchetypesEnabled || clinicianArchetypesEnabled

              if (!hasAnyEnabled) {
                return (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                    <p className="text-sm text-blue-700">
                      <strong>No appointment types have been configured yet.</strong>
                      <br />
                      Complete Step 2.5 of the onboarding wizard to help the AI choose the right slot types for your surgery.
                    </p>
                  </div>
                )
              }

              return (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    These are the appointment types the AI will use when rewriting instructions:
                  </p>
                  <div className="space-y-4">
                    {/* GP Appointment Archetypes */}
                    {Object.entries({
                      routineContinuityGp: appointmentModel.routineContinuityGp,
                      routineGpPhone: appointmentModel.routineGpPhone,
                      gpTriage48h: appointmentModel.gpTriage48h,
                      urgentSameDayPhone: appointmentModel.urgentSameDayPhone,
                      urgentSameDayF2F: appointmentModel.urgentSameDayF2F,
                      otherClinicianDirect: appointmentModel.otherClinicianDirect,
                    }).map(([key, config]) => {
                      if (!config.enabled) return null
                      return (
                        <div key={key} className="border-l-4 border-nhs-blue pl-4 py-2">
                          <div className="font-medium text-gray-900 mb-1">
                            {APPOINTMENT_ARCHETYPE_LABELS[key as Exclude<keyof AppointmentModelConfig, 'clinicianArchetypes'>]}
                          </div>
                          <div className="text-sm text-gray-700 space-y-1">
                            <div>Local name: {config.localName || '(not set)'}</div>
                            {config.clinicianRole && (
                              <div>Who: {config.clinicianRole}</div>
                            )}
                            {config.description && (
                              <div>Used for: {config.description}</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {/* Clinician Archetypes */}
                    {(appointmentModel.clinicianArchetypes || []).map((archetype) => {
                      if (!archetype.enabled) return null
                      const friendlyName = archetype.key === 'ANP' ? 'Minor Illness Clinician Appointment' :
                                         archetype.key === 'PHARMACIST' ? 'Clinical Pharmacist' :
                                         archetype.key === 'FCP' ? 'First Contact Physiotherapist' :
                                         archetype.key === 'OTHER' ? 'Other clinician or service' :
                                         archetype.key
                      return (
                        <div key={archetype.key} className="border-l-4 border-green-500 pl-4 py-2">
                          <div className="font-medium text-gray-900 mb-1">
                            {friendlyName}
                          </div>
                          <div className="text-sm text-gray-700 space-y-1">
                            <div>Local name: {archetype.localName || '(not set)'}</div>
                            {archetype.role && (
                              <div>Who: {archetype.role}</div>
                            )}
                            {archetype.description && (
                              <div>Used for: {archetype.description}</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )
            })()}
          </div>

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
                      <p className="text-xs text-gray-400 mt-1">
                        This will run AI customisation on every enabled symptom. Please keep this tab open until the process completes.
                      </p>
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
                    <>
                      {/* Search Input */}
                      <div className="mb-3">
                        <input
                          type="text"
                          placeholder="Search symptoms…"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          disabled={processing}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div className="border border-gray-300 rounded-lg max-h-96 overflow-y-auto">
                        <div className="p-4 space-y-2">
                          {symptoms
                            .filter((symptom) => {
                              if (!searchTerm.trim()) return true
                              const searchLower = searchTerm.toLowerCase()
                              const nameMatch = symptom.name.toLowerCase().includes(searchLower)
                              const briefMatch = symptom.briefInstruction?.toLowerCase().includes(searchLower) || false
                              return nameMatch || briefMatch
                            })
                            .map((symptom) => (
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
                          {symptoms.filter((symptom) => {
                            if (!searchTerm.trim()) return false
                            const searchLower = searchTerm.toLowerCase()
                            const nameMatch = symptom.name.toLowerCase().includes(searchLower)
                            const briefMatch = symptom.briefInstruction?.toLowerCase().includes(searchLower) || false
                            return nameMatch || briefMatch
                          }).length === 0 && searchTerm.trim() && (
                            <div className="text-center py-8 text-gray-500">
                              No symptoms found matching &quot;{searchTerm}&quot;
                            </div>
                          )}
                        </div>
                      </div>
                    </>
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
                      {processingProgress.currentSymptomName && (
                        <p className="text-sm text-blue-600 mt-1">
                          Currently customising: {processingProgress.currentSymptomName}
                        </p>
                      )}
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
                    (scope === 'manual' && selectedSymptomIds.length === 0) ||
                    (scope === 'all' && symptoms.length === 0)
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
                <div className="space-y-4">
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
                            href="/admin?tab=clinical-review"
                            className="underline font-medium"
                          >
                            Clinical Review
                          </Link>{' '}
                          page to approve them.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Skipped Symptoms Details */}
                  {result.skippedDetails && result.skippedDetails.length > 0 && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
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
                        <div className="ml-3 flex-1">
                          <p className="text-sm font-medium text-yellow-800 mb-2">
                            Skipped Symptoms ({result.skippedDetails.length})
                          </p>
                          <div className="space-y-2">
                            {result.skippedDetails.map((skipped, index) => {
                              const symptom = symptoms.find(s => s.id === skipped.symptomId)
                              return (
                                <div key={index} className="text-sm text-yellow-700">
                                  <span className="font-medium">
                                    {symptom?.name || `Symptom ${skipped.symptomId}`}
                                  </span>
                                  {skipped.reason && (
                                    <span className="ml-2 text-yellow-600">
                                      ({skipped.reason})
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

