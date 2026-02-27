'use client'

import Link from 'next/link'

interface SetupChecklistClientProps {
  surgeryId: string
  surgeryName: string
  onboardingCompleted: boolean
  onboardingCompletedAt: Date | null
  onboardingUpdatedAt: Date | null
  appointmentModelConfigured: boolean
  aiCustomisationOccurred: boolean
  pendingCount: number
  standalone?: boolean
}

type ChecklistItemStatus = 'completed' | 'pending' | 'warning'

interface ChecklistItem {
  id: string
  title: string
  description: string
  status: ChecklistItemStatus
  actionLabel: string
  actionHref: string
}

export default function SetupChecklistClient({
  surgeryId,
  surgeryName,
  onboardingCompleted,
  onboardingCompletedAt,
  onboardingUpdatedAt,
  appointmentModelConfigured,
  aiCustomisationOccurred,
  pendingCount,
  standalone = false,
}: SetupChecklistClientProps) {
  const formatDate = (date: Date | string | null): string => {
    if (!date) return 'unknown'
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const onboardingDescription = (() => {
    if (!onboardingCompleted) {
      return 'Complete the onboarding questionnaire to configure your surgery profile.'
    }
    const completedStr = `Completed on ${formatDate(onboardingCompletedAt)}`
    if (onboardingUpdatedAt && onboardingCompletedAt) {
      const completedDay = new Date(onboardingCompletedAt).toDateString()
      const updatedDay = new Date(onboardingUpdatedAt).toDateString()
      if (completedDay !== updatedDay) {
        return `${completedStr} · Last updated ${formatDate(onboardingUpdatedAt)}`
      }
    }
    return completedStr
  })()

  // Build checklist items
  const checklistItems: ChecklistItem[] = [
    {
      id: 'onboarding',
      title: 'Onboarding completed?',
      description: onboardingDescription,
      status: onboardingCompleted ? 'completed' : 'pending',
      actionLabel: onboardingCompleted ? 'Edit onboarding' : 'Start onboarding',
      actionHref: `/s/${surgeryId}/admin/onboarding`,
    },
    {
      id: 'appointment-model',
      title: 'Appointment model configured?',
      description: appointmentModelConfigured
        ? 'At least one appointment archetype is enabled.'
        : 'Configure appointment types in the onboarding wizard (Step 2.5).',
      status: appointmentModelConfigured ? 'completed' : 'pending',
      actionLabel: 'Edit appointment model',
      actionHref: `/s/${surgeryId}/admin/onboarding?step=2.5`,
    },
    {
      id: 'ai-customisation',
      title: 'AI customisation (Beta)',
      description: aiCustomisationOccurred
        ? 'AI customisation has been applied to your symptoms.'
        : 'Run the AI customiser to generate surgery-specific instruction wording. All outputs go through clinical review before going live.',
      status: aiCustomisationOccurred ? 'completed' : 'pending',
      actionLabel: 'Open AI Setup (Beta)',
      actionHref: `/s/${surgeryId}/admin/ai-setup`,
    },
    {
      id: 'clinical-review',
      title: 'Pending clinical review',
      description: pendingCount === 0
        ? 'All symptoms approved'
        : `${pendingCount} symptom${pendingCount === 1 ? '' : 's'} require${pendingCount === 1 ? 's' : ''} clinical review`,
      status: pendingCount === 0 ? 'completed' : 'warning',
      actionLabel: pendingCount === 0 ? 'View clinical review' : 'Review now',
      actionHref: `/admin?tab=clinical-review`,
    },
  ]

  // Check if all steps are complete
  const allStepsComplete =
    onboardingCompleted &&
    appointmentModelConfigured &&
    aiCustomisationOccurred &&
    pendingCount === 0

  const getStatusIcon = (status: ChecklistItemStatus) => {
    switch (status) {
      case 'completed':
        return <span className="text-green-600 text-xl">✓</span>
      case 'warning':
        return <span className="text-amber-600 text-xl">!</span>
      case 'pending':
        return <span className="text-gray-400 text-xl">•</span>
    }
  }

  const getBorderColor = (status: ChecklistItemStatus) => {
    switch (status) {
      case 'completed':
        return 'border-l-green-500'
      case 'warning':
        return 'border-l-amber-500'
      case 'pending':
        return 'border-l-gray-300'
    }
  }

  const content = (
    <>
      {standalone && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-nhs-dark-blue mb-2">
            Setup Checklist
          </h1>
          <p className="text-nhs-grey">
            Track your surgery setup progress and ensure everything is configured correctly.
          </p>
        </div>
      )}
      {!standalone && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-nhs-dark-blue mb-2">
            Setup Checklist
          </h2>
          <p className="text-nhs-grey">
            Track your surgery setup progress and ensure everything is configured correctly.
          </p>
        </div>
      )}

        <div className="space-y-4">
          {checklistItems.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-lg shadow-sm border-l-4 ${getBorderColor(item.status)} p-6`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="flex-shrink-0 mt-1">{getStatusIcon(item.status)}</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-nhs-dark-blue mb-1">
                      {item.title}
                    </h3>
                    <p className="text-sm text-nhs-grey">{item.description}</p>
                    {item.id === 'clinical-review' && pendingCount > 0 && (
                      <div className="mt-3 text-xs text-gray-600">
                        <p className="font-medium mb-1">Suggested review order:</p>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Review high-risk symptoms first (e.g. chest pain, stroke, sepsis, very unwell children).</li>
                          <li>Next, review symptoms where the clinician type matters locally (for example where you want Minor Illness Clinicians, FCPs or pharmacists involved).</li>
                          <li>Then work through the remaining symptoms in your own priority order.</li>
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 ml-4">
                  <Link
                    href={item.actionHref}
                    className="inline-flex items-center px-4 py-2 bg-nhs-blue text-white rounded-md hover:bg-nhs-dark-blue transition-colors text-sm font-medium"
                  >
                    {item.actionLabel}
                  </Link>
                </div>
              </div>
            </div>
          ))}

          {/* Final "Ready to go live" item */}
          <div
            className={`bg-white rounded-lg shadow-sm border-l-4 ${
              allStepsComplete ? 'border-l-green-500' : 'border-l-gray-300'
            } p-6`}
          >
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 mt-1">
                {allStepsComplete ? (
                  <span className="text-green-600 text-xl">✓</span>
                ) : (
                  <span className="text-gray-400 text-xl">•</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-nhs-dark-blue mb-1">
                  Ready to go live?
                </h3>
                <p className="text-sm text-nhs-grey">
                  {allStepsComplete
                    ? 'All setup steps are complete. Your surgery is ready to go live!'
                    : 'Complete all steps above to finalise setup.'}
                </p>
              </div>
            </div>
          </div>
        </div>
    </>
  )

  if (standalone) {
    return (
      <div className="min-h-screen bg-nhs-light-grey">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {content}
        </div>
      </div>
    )
  }

  return <div>{content}</div>
}

