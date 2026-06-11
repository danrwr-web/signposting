import { getClinicalReviewNoticeTier } from '@/lib/clinicalReviewCounts'

interface ClinicalReviewNoticeProps {
  pendingCount: number
  surgeryName: string
}

/**
 * Full-width notice shown below the toolbar when symptoms are awaiting
 * clinical review. Two tiers: a prominent warning when many symptoms are
 * pending, and a subtle one-line note when only a few are (e.g. a newly
 * added or edited symptom). Visible to all roles, including admins.
 *
 * Note: deliberately not AlertBanner — that is a rounded in-container card
 * with role="alert"; this is a persistent edge-to-edge strip.
 */
export default function ClinicalReviewNotice({ pendingCount, surgeryName }: ClinicalReviewNoticeProps) {
  const tier = getClinicalReviewNoticeTier(pendingCount)

  if (tier === 'none') {
    return null
  }

  if (tier === 'subtle') {
    return (
      <div className="bg-blue-50 border-b border-blue-100 py-2" role="status">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <svg className="h-4 w-4 text-nhs-blue flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="ml-2 text-sm text-nhs-dark-blue">
              {pendingCount} {pendingCount === 1 ? 'symptom is' : 'symptoms are'} awaiting clinical review. If you&apos;re unsure, please check with a clinician before booking.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4" role="status">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              <strong>Content for {surgeryName} is awaiting local clinical review.</strong> If you&apos;re unsure, please check with a clinician before booking.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
