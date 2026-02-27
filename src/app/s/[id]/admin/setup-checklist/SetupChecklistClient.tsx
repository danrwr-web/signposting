'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button, Card, Badge, AlertBanner } from '@/components/ui'

// --- Types ---

type ChecklistData = {
  onboardingCompleted: boolean
  appointmentModelConfigured: boolean
  aiCustomisationRun: boolean
  pendingReviewCount: number
  standardUsersCount: number
  highRiskConfigured: boolean
  highlightsEnabled: boolean
  appointmentTypeCount: number
  handbookItemCount: number
}

type HealthData = {
  pendingReviewCount: number
  changesRequestedCount: number
  lastReviewActivity: string | null
  activeUsersLast30: number
  totalViewsLast30: number
  topSymptomId: string | null
  topSymptomCount: number
  approvedCount: number
  recentlyUpdatedCount: number
}

type PageMode = 'setup' | 'nearly-there' | 'health'

interface SetupChecklistClientProps {
  surgeryId: string
  surgeryName: string
  checklist: ChecklistData
  health: HealthData
  features: string[]
  onboardingCompletedAt: string | null
  onboardingUpdatedAt: string | null
  standalone?: boolean
}

// --- Helpers ---

function formatDate(date: Date | string | null): string {
  if (!date) return 'unknown'
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return 'No recent activity'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Active today'
  if (days === 1) return 'Active 1 day ago'
  return `Active ${days} days ago`
}

function getPendingColor(count: number): string {
  if (count < 10) return 'text-green-600'
  if (count <= 50) return 'text-amber-600'
  return 'text-red-600'
}

function getPendingBadgeColor(count: number): 'green' | 'amber' | 'red' {
  if (count < 10) return 'green'
  if (count <= 50) return 'amber'
  return 'red'
}

// --- Main Component ---

export default function SetupChecklistClient({
  surgeryId,
  surgeryName,
  checklist,
  health,
  features,
  onboardingCompletedAt,
  onboardingUpdatedAt,
  standalone = false,
}: SetupChecklistClientProps) {
  const searchParams = useSearchParams()
  const previewMode = searchParams.get('preview')

  const aiEnabled = features.includes('ai_surgery_customisation')
  const handbookEnabled = features.includes('admin_toolkit')

  // Essential items (must all be true for health mode)
  const essentialItems = [
    checklist.onboardingCompleted,
    checklist.appointmentModelConfigured,
    checklist.standardUsersCount > 0,
    checklist.highRiskConfigured,
    aiEnabled ? checklist.aiCustomisationRun : true,
    checklist.pendingReviewCount < 10,
  ]
  const essentialComplete = essentialItems.every(Boolean)
  const essentialCount = essentialItems.filter(Boolean).length
  const essentialTotal = essentialItems.length

  // Recommended items
  const recommendedItems = [
    checklist.appointmentTypeCount > 0,
    checklist.highlightsEnabled,
    handbookEnabled ? checklist.handbookItemCount > 0 : true,
  ]
  const recommendedComplete = recommendedItems.every(Boolean)

  // Determine page mode
  const mode: PageMode = previewMode === 'health'
    ? 'health'
    : essentialComplete
      ? (recommendedComplete ? 'health' : 'nearly-there')
      : 'setup'

  const pageTitle = mode === 'health' ? 'Surgery Health' : 'Setup Checklist'
  const pageDescription = mode === 'health'
    ? `Overview of ${surgeryName}'s operational health and activity.`
    : 'Track your surgery setup progress and ensure everything is configured correctly.'

  const content = (
    <>
      {standalone && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-nhs-dark-blue mb-2">
            {pageTitle}
          </h1>
          <p className="text-nhs-grey">{pageDescription}</p>
        </div>
      )}
      {!standalone && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-nhs-dark-blue mb-2">
            {pageTitle}
          </h2>
          <p className="text-nhs-grey">{pageDescription}</p>
        </div>
      )}

      {mode === 'health' ? (
        <HealthDashboard
          surgeryId={surgeryId}
          health={health}
          aiEnabled={aiEnabled}
        />
      ) : (
        <ChecklistView
          surgeryId={surgeryId}
          checklist={checklist}
          health={health}
          mode={mode}
          aiEnabled={aiEnabled}
          handbookEnabled={handbookEnabled}
          essentialCount={essentialCount}
          essentialTotal={essentialTotal}
          onboardingCompletedAt={onboardingCompletedAt}
          onboardingUpdatedAt={onboardingUpdatedAt}
        />
      )}
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

// --- Checklist View (setup + nearly-there) ---

function ChecklistView({
  surgeryId,
  checklist,
  mode,
  aiEnabled,
  handbookEnabled,
  essentialCount,
  essentialTotal,
  onboardingCompletedAt,
  onboardingUpdatedAt,
}: {
  surgeryId: string
  checklist: ChecklistData
  health: HealthData
  mode: 'setup' | 'nearly-there'
  aiEnabled: boolean
  handbookEnabled: boolean
  essentialCount: number
  essentialTotal: number
  onboardingCompletedAt: string | null
  onboardingUpdatedAt: string | null
}) {
  return (
    <>
      {mode === 'nearly-there' && (
        <AlertBanner variant="info" className="mb-6">
          <div>
            <p className="font-semibold">All essential steps complete — your surgery is ready to go live.</p>
            <p className="mt-1">A few recommended steps remain to get the most from the toolkit.</p>
          </div>
        </AlertBanner>
      )}

      {/* Essential Steps */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-nhs-dark-blue mb-3">Essential steps</h2>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-nhs-grey">
              {essentialCount} of {essentialTotal} steps complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-nhs-blue h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${essentialTotal > 0 ? (essentialCount / essentialTotal) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="space-y-3">
          <EssentialItem
            complete={checklist.onboardingCompleted}
            title="Practice questionnaire"
            incompleteDescription="Tell us about your surgery so AI customisation works correctly"
            completeDescription={getOnboardingDescription(onboardingCompletedAt, onboardingUpdatedAt)}
            actionHref={`/s/${surgeryId}/admin/onboarding`}
            actionLabel={checklist.onboardingCompleted ? 'Edit' : 'Start'}
          />
          <EssentialItem
            complete={checklist.appointmentModelConfigured}
            title="Appointment model"
            incompleteDescription="Define the appointment types and clinicians available at your surgery"
            completeDescription="Configured"
            actionHref={`/s/${surgeryId}/admin/onboarding?step=2.5`}
            actionLabel="Edit"
          />
          <EssentialItem
            complete={checklist.standardUsersCount > 0}
            title="Add team members"
            incompleteDescription="Add at least one reception or care navigation user so staff can log in"
            completeDescription={`${checklist.standardUsersCount} user${checklist.standardUsersCount === 1 ? '' : 's'} added`}
            actionHref={`/s/${surgeryId}/admin/users`}
            actionLabel="Manage users"
          />
          <EssentialItem
            complete={checklist.highRiskConfigured}
            title="High-risk buttons"
            incompleteDescription="Configure high-risk quick-access buttons for urgent symptoms like chest pain and stroke"
            completeDescription="Configured"
            actionHref={`/s/${surgeryId}/admin/signposting-settings`}
            actionLabel="Configure"
          />
          {aiEnabled && (
            <EssentialItem
              complete={checklist.aiCustomisationRun}
              title="AI customisation"
              incompleteDescription="Run AI customisation to tailor symptom instructions to your appointment model"
              completeDescription="AI customisation has been run"
              actionHref={`/s/${surgeryId}/admin/ai-setup`}
              actionLabel="Open AI Setup"
            />
          )}
          <ClinicalReviewItem
            pendingCount={checklist.pendingReviewCount}
            surgeryId={surgeryId}
          />
        </div>
      </div>

      {/* Recommended Steps */}
      <div>
        <h2 className="text-lg font-bold text-nhs-dark-blue mb-2">Recommended</h2>
        <p className="text-sm text-nhs-grey mb-4">
          These steps aren&apos;t required to go live, but will improve your team&apos;s experience.
        </p>

        <div className="space-y-3">
          <RecommendedItem
            complete={checklist.appointmentTypeCount > 0}
            title="Appointment directory"
            description="Add local services and appointment types so staff can search them"
            actionHref={`/s/${surgeryId}/appointments/admin`}
            actionLabel="Set up"
          />
          <RecommendedItem
            complete={checklist.highlightsEnabled}
            title="Highlight rules"
            description="Enable colour-coded highlights to draw attention to urgent phrases"
            actionHref={`/s/${surgeryId}/admin/signposting-settings#highlights`}
            actionLabel="Configure"
          />
          {handbookEnabled && (
            <RecommendedItem
              complete={checklist.handbookItemCount > 0}
              title="Practice Handbook"
              description="Add internal guidance pages for your team"
              actionHref={`/s/${surgeryId}/admin-toolkit`}
              actionLabel="Open"
            />
          )}
        </div>
      </div>
    </>
  )
}

// --- Essential Item ---

function EssentialItem({
  complete,
  title,
  incompleteDescription,
  completeDescription,
  actionHref,
  actionLabel,
}: {
  complete: boolean
  title: string
  incompleteDescription: string
  completeDescription: string
  actionHref: string
  actionLabel: string
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow-sm border-l-4 ${
        complete ? 'border-l-green-500' : 'border-l-amber-400'
      } p-5`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="flex-shrink-0 mt-0.5">
            {complete ? (
              <span className="text-green-600 text-lg font-bold">&#10003;</span>
            ) : (
              <span className="text-amber-500 text-lg font-bold">!</span>
            )}
          </div>
          <div className="flex-1">
            <h3 className={`text-base font-semibold ${complete ? 'text-green-700' : 'text-nhs-dark-blue'}`}>
              {title}
            </h3>
            <p className="text-sm text-nhs-grey mt-0.5">
              {complete ? completeDescription : incompleteDescription}
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 ml-4">
          <Link href={actionHref}>
            <Button variant={complete ? 'secondary' : 'primary'} size="sm">
              {actionLabel}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

// --- Clinical Review Item (special essential item) ---

function ClinicalReviewItem({
  pendingCount,
  surgeryId,
}: {
  pendingCount: number
  surgeryId: string
}) {
  const complete = pendingCount < 10

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border-l-4 ${
        complete ? 'border-l-green-500' : 'border-l-amber-400'
      } p-5`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="flex-shrink-0 mt-0.5">
            {complete ? (
              <span className="text-green-600 text-lg font-bold">&#10003;</span>
            ) : (
              <span className="text-amber-500 text-lg font-bold">!</span>
            )}
          </div>
          <div className="flex-1">
            <h3 className={`text-base font-semibold ${complete ? 'text-green-700' : 'text-nhs-dark-blue'}`}>
              Clinical review
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-nhs-grey">
                {complete
                  ? 'Fewer than 10 pending'
                  : `${pendingCount} symptom${pendingCount === 1 ? '' : 's'} pending review`}
              </p>
              {!complete && (
                <Badge color={getPendingBadgeColor(pendingCount)} size="sm">
                  {pendingCount}
                </Badge>
              )}
            </div>
            {!complete && pendingCount > 0 && (
              <div className="mt-3 text-xs text-gray-600">
                <p className="font-medium mb-1">Suggested review order:</p>
                <ol className="list-decimal list-inside space-y-1.5 ml-2">
                  <li>
                    Use &quot;High-risk symptoms first&quot; sort to review chest pain, stroke, sepsis and similar urgent symptoms.
                    <Link href="/admin?tab=clinical-review&sort=high-risk-first" className="ml-1 text-nhs-blue hover:underline">
                      Open with this sort
                    </Link>
                  </li>
                  <li>
                    Use &quot;Clinician-type symptoms first&quot; to review symptoms routed to ANP, FCP or pharmacist.
                    <Link href="/admin?tab=clinical-review&sort=clinician-type-first" className="ml-1 text-nhs-blue hover:underline">
                      Open with this sort
                    </Link>
                  </li>
                  <li>Then work through the remaining symptoms in your own priority order.</li>
                </ol>
              </div>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 ml-4">
          <Link href={`/s/${surgeryId}/admin/clinical-review`}>
            <Button variant={complete ? 'secondary' : 'primary'} size="sm">
              {complete ? 'View' : 'Review now'}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

// --- Recommended Item ---

function RecommendedItem({
  complete,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  complete: boolean
  title: string
  description: string
  actionHref: string
  actionLabel: string
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow-sm border-l-4 ${
        complete ? 'border-l-green-500' : 'border-l-gray-300'
      } p-5`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="flex-shrink-0 mt-0.5">
            {complete ? (
              <span className="text-green-600 text-lg font-bold">&#10003;</span>
            ) : (
              <span className="text-gray-400 text-lg">&middot;</span>
            )}
          </div>
          <div className="flex-1">
            <h3 className={`text-base font-semibold ${complete ? 'text-green-700' : 'text-gray-600'}`}>
              {title}
            </h3>
            <p className={`text-sm mt-0.5 ${complete ? 'text-nhs-grey' : 'text-gray-500'}`}>
              {description}
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 ml-4">
          <Link href={actionHref}>
            <Button variant="secondary" size="sm">
              {actionLabel}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

// --- Health Dashboard ---

function HealthDashboard({
  surgeryId,
  health,
  aiEnabled,
}: {
  surgeryId: string
  health: HealthData
  aiEnabled: boolean
}) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Governance Card */}
        <Card elevation="raised" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <svg className="h-5 w-5 text-nhs-blue" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
            <h3 className="text-base font-bold text-nhs-dark-blue">Clinical Governance</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-nhs-grey">Pending review</span>
              <Link href={`/s/${surgeryId}/admin/clinical-review`} className="hover:underline">
                <span className={`text-sm font-semibold ${getPendingColor(health.pendingReviewCount)}`}>
                  {health.pendingReviewCount}
                </span>
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-nhs-grey">Changes requested</span>
              <Link href={`/s/${surgeryId}/admin/clinical-review`} className="hover:underline">
                <span className="text-sm font-semibold text-nhs-dark-blue">
                  {health.changesRequestedCount}
                </span>
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-nhs-grey">Last review activity</span>
              <span className="text-sm text-nhs-dark-blue">
                {daysAgo(health.lastReviewActivity)}
              </span>
            </div>
          </div>
        </Card>

        {/* Usage Card */}
        <Card elevation="raised" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <svg className="h-5 w-5 text-nhs-blue" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" />
            </svg>
            <h3 className="text-base font-bold text-nhs-dark-blue">Usage (last 30 days)</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-nhs-grey">Active users</span>
              <span className="text-sm font-semibold text-nhs-dark-blue">
                {health.activeUsersLast30 > 0 ? `${health.activeUsersLast30} active` : '\u2014'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-nhs-grey">Symptom views</span>
              <span className="text-sm font-semibold text-nhs-dark-blue">
                {health.totalViewsLast30 > 0 ? `${health.totalViewsLast30} views` : '\u2014'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-nhs-grey">Most viewed</span>
              <Link href={`/s/${surgeryId}/analytics`} className="text-sm text-nhs-blue hover:underline">
                View analytics &rarr;
              </Link>
            </div>
          </div>
        </Card>

        {/* Content Health Card */}
        <Card elevation="raised" padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <svg className="h-5 w-5 text-nhs-blue" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
            </svg>
            <h3 className="text-base font-bold text-nhs-dark-blue">Content Health</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-nhs-grey">Approved symptoms</span>
              <span className="text-sm font-semibold text-nhs-dark-blue">
                {health.approvedCount > 0 ? `${health.approvedCount} approved` : '\u2014'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-nhs-grey">Recently updated</span>
              <span className="text-sm font-semibold text-nhs-dark-blue">
                {health.recentlyUpdatedCount > 0 ? `${health.recentlyUpdatedCount} in last 30 days` : '\u2014'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-nhs-grey">Pending review</span>
              <Link href={`/s/${surgeryId}/admin/clinical-review`} className="hover:underline">
                <span className={`text-sm font-semibold ${getPendingColor(health.pendingReviewCount)}`}>
                  {health.pendingReviewCount}
                </span>
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href={`/s/${surgeryId}/admin/clinical-review`}>
          <Button variant={health.pendingReviewCount > 0 ? 'primary' : 'secondary'} size="md">
            Review pending ({health.pendingReviewCount})
          </Button>
        </Link>
        <Link href={`/s/${surgeryId}/admin/onboarding`}>
          <Button variant="secondary" size="md">
            Edit practice profile
          </Button>
        </Link>
        {aiEnabled && (
          <Link href={`/s/${surgeryId}/admin/ai-setup`}>
            <Button variant="secondary" size="md">
              Open AI Setup
            </Button>
          </Link>
        )}
        <Link href={`/s/${surgeryId}/admin/users`}>
          <Button variant="secondary" size="md">
            Manage users
          </Button>
        </Link>
      </div>
    </>
  )
}

// --- Helper for onboarding description ---

function getOnboardingDescription(
  completedAt: string | null,
  updatedAt: string | null,
): string {
  const completedStr = `Completed ${formatDate(completedAt)}`
  if (updatedAt && completedAt) {
    const completedDay = new Date(completedAt).toDateString()
    const updatedDay = new Date(updatedAt).toDateString()
    if (completedDay !== updatedDay) {
      return `${completedStr} \u00B7 Last updated ${formatDate(updatedAt)}`
    }
  }
  return completedStr
}
