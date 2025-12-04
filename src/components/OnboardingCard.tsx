'use client'

import { Surgery } from '@prisma/client'

interface OnboardingCardProps {
  surgery: Surgery | undefined
  surgeryId: string
}

export default function OnboardingCard({ surgery, surgeryId }: OnboardingCardProps) {
  const onboardingCompleted = surgery?.onboardingProfile?.completed ?? false
  const completedAt = surgery?.onboardingProfile?.completedAt

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        Onboarding & AI Setup
      </h3>
      {onboardingCompleted ? (
        <>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-green-800 mb-1">
              <strong>✓ Onboarding completed</strong>
            </p>
            {completedAt && (
              <p className="text-xs text-green-700">
                Completed on {new Date(completedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Your surgery profile is configured. You can update it anytime or proceed to AI customisation.
          </p>
          <div className="flex gap-3">
            <a
              href={`/s/${surgeryId}/admin/onboarding`}
              className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
            >
              Edit Onboarding
            </a>
            <a
              href={`/s/${surgeryId}/admin/ai-setup`}
              className="inline-flex items-center px-4 py-2 bg-nhs-blue text-white rounded-md hover:bg-nhs-dark-blue transition-colors text-sm"
            >
              Go to AI Setup
            </a>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600 mb-4">
            Tell the tool how your surgery works so AI can tailor instructions.
          </p>
          <a
            href={`/s/${surgeryId}/admin/onboarding`}
            className="inline-flex items-center px-4 py-2 bg-nhs-blue text-white rounded-md hover:bg-nhs-dark-blue transition-colors"
          >
            Complete Onboarding Questionnaire
          </a>
        </>
      )}
    </div>
  )
}

