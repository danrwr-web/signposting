'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatRelativeDate } from '@/lib/formatRelativeDate'

interface SignpostingData {
  views7d: number
  views30d: number
  topSymptoms: Array<{ id: string; name: string; views: number }>
  distinctStaffCount: number
}

interface HandbookData {
  views7d: number
  views30d: number
  topPages: Array<{ id: string; name: string; views: number }>
  distinctStaffCount: number
}

interface WorkflowData {
  views7d: number
  views30d: number
  topWorkflows: Array<{ id: string; name: string; views: number }>
  distinctStaffCount: number
}

interface StaffUsage {
  userId: string
  name: string
  email: string
  accessedSignposting: boolean
  accessedHandbook: boolean
  accessedWorkflow: boolean
  lastActiveAt: string | null
}

interface AnalyticsData {
  enabledModules: {
    signposting: boolean
    handbook: boolean
    workflow: boolean
  }
  signposting: SignpostingData | null
  handbook: HandbookData | null
  workflow: WorkflowData | null
  staffUsage: StaffUsage[]
}

interface AnalyticsClientProps {
  surgeryId: string
}

export default function AnalyticsClient({ surgeryId }: AnalyticsClientProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AnalyticsData | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    fetch(`/api/analytics?surgeryId=${surgeryId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch analytics data')
        return res.json()
      })
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [surgeryId])

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Loading analytics...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">{error}</p>
        </div>
      </main>
    )
  }

  if (!data) {
    return null
  }

  const { enabledModules, signposting, handbook, workflow, staffUsage } = data

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-base text-gray-600">
          Overview of how this practice uses guidance and tools
        </p>
      </div>

      {/* Guardrail Copy */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <div className="flex items-start gap-3">
          <svg 
            className="flex-none h-5 w-5 text-blue-600 mt-0.5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-900">About this data</p>
            <p className="text-sm text-blue-800 mt-1">
              Analytics show aggregated usage to support onboarding, governance, and service improvement. 
              They are not designed to monitor individual performance.
            </p>
          </div>
        </div>
      </div>

      {/* Module Summaries */}
      <div className="space-y-6 mb-10">
        {/* Signposting Toolkit */}
        {enabledModules.signposting && signposting && (
          <ModuleSummaryCard
            title="Signposting Toolkit"
            subtitle="Is signposting being used at all, and where?"
            views7d={signposting.views7d}
            views30d={signposting.views30d}
            topItemsLabel="Most used symptoms"
            topItems={signposting.topSymptoms}
            distinctStaffCount={signposting.distinctStaffCount}
            engagementLink={`/s/${surgeryId}`}
            engagementLinkLabel="Go to Signposting"
          />
        )}

        {/* Practice Handbook */}
        {enabledModules.handbook && handbook && (
          <ModuleSummaryCard
            title="Practice Handbook"
            subtitle="Is the handbook alive and being referenced?"
            views7d={handbook.views7d}
            views30d={handbook.views30d}
            topItemsLabel="Most viewed pages"
            topItems={handbook.topPages}
            distinctStaffCount={handbook.distinctStaffCount}
            engagementLink={`/s/${surgeryId}/admin-toolkit/admin`}
            engagementLinkLabel="View detailed engagement"
          />
        )}

        {/* Workflow Guidance */}
        {enabledModules.workflow && workflow && (
          <ModuleSummaryCard
            title="Workflow Guidance"
            subtitle="Are workflows being looked at and relied upon?"
            views7d={workflow.views7d}
            views30d={workflow.views30d}
            topItemsLabel="Most viewed workflows"
            topItems={workflow.topWorkflows}
            distinctStaffCount={workflow.distinctStaffCount}
            engagementLink={`/s/${surgeryId}/workflow/admin/engagement`}
            engagementLinkLabel="View detailed engagement"
          />
        )}
      </div>

      {/* Usage by Staff Section */}
      <StaffUsageSection 
        staffUsage={staffUsage} 
        enabledModules={enabledModules}
      />
    </main>
  )
}

/**
 * Module summary card component - renders a calm summary for each enabled module.
 */
interface ModuleSummaryCardProps {
  title: string
  subtitle: string
  views7d: number
  views30d: number
  topItemsLabel: string
  topItems: Array<{ id: string; name: string; views: number }>
  distinctStaffCount: number
  engagementLink: string
  engagementLinkLabel: string
}

function ModuleSummaryCard({
  title,
  subtitle,
  views7d,
  views30d,
  topItemsLabel,
  topItems,
  distinctStaffCount,
  engagementLink,
  engagementLinkLabel,
}: ModuleSummaryCardProps) {
  return (
    <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>

      <div className="p-5">
        {/* Views Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-semibold text-gray-900 tabular-nums">
              {views7d.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">views (7 days)</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-semibold text-gray-900 tabular-nums">
              {views30d.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">views (30 days)</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-semibold text-gray-900 tabular-nums">
              {distinctStaffCount}
            </p>
            <p className="text-xs text-gray-500 mt-1">staff engaged</p>
          </div>
        </div>

        {/* Top Items */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">{topItemsLabel}</h3>
          {topItems.length > 0 ? (
            <ul className="space-y-2">
              {topItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md text-sm"
                >
                  <span className="text-gray-900">{item.name}</span>
                  <span className="text-gray-500 tabular-nums">
                    {item.views.toLocaleString()} {item.views === 1 ? 'view' : 'views'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 py-2">No data recorded yet.</p>
          )}
        </div>

        {/* Engagement Link */}
        <div className="pt-3 border-t border-gray-100">
          <Link
            href={engagementLink}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            {engagementLinkLabel} →
          </Link>
        </div>
      </div>
    </section>
  )
}

/**
 * Staff usage section - shows which staff have accessed which modules.
 * Presence only, not performance.
 */
interface StaffUsageSectionProps {
  staffUsage: StaffUsage[]
  enabledModules: {
    signposting: boolean
    handbook: boolean
    workflow: boolean
  }
}

function StaffUsageSection({ staffUsage, enabledModules }: StaffUsageSectionProps) {
  return (
    <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">Usage by staff</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Who is engaging with the system at all? (last 30 days)
        </p>
      </div>

      <div className="p-5">
        {staffUsage.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-600">
                    Staff member
                  </th>
                  <th className="text-center py-2 px-4 font-medium text-gray-600">
                    Modules accessed
                  </th>
                  <th className="text-right py-2 pl-4 font-medium text-gray-600">
                    Last active
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffUsage.map((staff) => (
                  <tr key={staff.userId}>
                    <td className="py-3 pr-4">
                      <div>
                        <span className="font-medium text-gray-900">{staff.name}</span>
                        {staff.email !== staff.name && (
                          <span className="block text-xs text-gray-500 mt-0.5">
                            {staff.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-3">
                        {enabledModules.signposting && (
                          <ModuleAccessIndicator
                            label="Signposting"
                            shortLabel="S"
                            accessed={staff.accessedSignposting}
                          />
                        )}
                        {enabledModules.handbook && (
                          <ModuleAccessIndicator
                            label="Handbook"
                            shortLabel="H"
                            accessed={staff.accessedHandbook}
                          />
                        )}
                        {enabledModules.workflow && (
                          <ModuleAccessIndicator
                            label="Workflow"
                            shortLabel="W"
                            accessed={staff.accessedWorkflow}
                          />
                        )}
                      </div>
                    </td>
                    <td className="py-3 pl-4 text-right text-gray-500">
                      {formatRelativeDate(staff.lastActiveAt ? new Date(staff.lastActiveAt) : null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">
            No staff activity recorded in the last 30 days.
          </p>
        )}
      </div>
    </section>
  )
}

/**
 * Module access indicator - shows a tick or neutral indicator for module access.
 */
interface ModuleAccessIndicatorProps {
  label: string
  shortLabel: string
  accessed: boolean
}

function ModuleAccessIndicator({ label, shortLabel, accessed }: ModuleAccessIndicatorProps) {
  return (
    <div
      className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium ${
        accessed
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-100 text-gray-400'
      }`}
      title={`${label}: ${accessed ? 'Accessed' : 'Not accessed'}`}
      aria-label={`${label}: ${accessed ? 'Accessed' : 'Not accessed'}`}
    >
      {accessed ? (
        <svg 
          className="w-4 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M5 13l4 4L19 7" 
          />
        </svg>
      ) : (
        <span aria-hidden="true">{shortLabel}</span>
      )}
    </div>
  )
}
