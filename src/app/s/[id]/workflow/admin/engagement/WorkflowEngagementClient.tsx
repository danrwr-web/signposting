'use client'

import { useEffect, useState } from 'react'
import { formatRelativeDate } from '@/lib/formatRelativeDate'

interface EngagementData {
  totalViews7d: number
  totalViews30d: number
  topWorkflows: Array<{
    id: string
    name: string
    views: number
  }>
  recentWorkflows: Array<{
    id: string
    name: string
    lastViewedAt: string
  }>
  byUser30d: Array<{
    userId: string
    name: string
    email: string | null
    views: number
    lastViewedAt: string
  }>
}

interface WorkflowEngagementClientProps {
  surgeryId: string
}

export default function WorkflowEngagementClient({ surgeryId }: WorkflowEngagementClientProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<EngagementData | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    fetch(`/api/workflow/engagement?surgeryId=${surgeryId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch engagement data')
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
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-3 text-sm text-gray-500">Loading engagement data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">{error}</p>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="flex-none h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Last 7 days</p>
              <p className="text-2xl font-semibold text-gray-900">{data.totalViews7d.toLocaleString()}</p>
              <p className="text-xs text-gray-500">workflow views</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="flex-none h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Last 30 days</p>
              <p className="text-2xl font-semibold text-gray-900">{data.totalViews30d.toLocaleString()}</p>
              <p className="text-xs text-gray-500">workflow views</p>
            </div>
          </div>
        </div>
      </div>

      {/* Most Viewed Workflows */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-900">Most viewed workflows</h2>
          <p className="text-sm text-gray-500 mt-0.5">Last 30 days</p>
        </div>
        <div className="p-5">
          {data.topWorkflows.length > 0 ? (
            <ul className="space-y-3">
              {data.topWorkflows.map((workflow) => (
                <li
                  key={workflow.id}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm font-medium text-gray-900">{workflow.name}</span>
                  <span className="text-sm text-gray-600 tabular-nums">
                    {workflow.views.toLocaleString()} {workflow.views === 1 ? 'view' : 'views'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              No workflow views recorded yet.
            </p>
          )}
        </div>
      </div>

      {/* Recently Viewed Workflows */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-900">Recently viewed workflows</h2>
          <p className="text-sm text-gray-500 mt-0.5">Last 7 days</p>
        </div>
        <div className="p-5">
          {data.recentWorkflows.length > 0 ? (
            <ul className="space-y-3">
              {data.recentWorkflows.map((workflow) => (
                <li
                  key={workflow.id}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm font-medium text-gray-900">{workflow.name}</span>
                  <span className="text-sm text-gray-500">
                    {formatRelativeDate(new Date(workflow.lastViewedAt))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              No recent workflow views.
            </p>
          )}
        </div>
      </div>

      {/* Usage by Staff */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-900">Usage by staff</h2>
          <p className="text-sm text-gray-500 mt-0.5">Last 30 days</p>
        </div>
        <div className="p-5">
          {data.byUser30d && data.byUser30d.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 font-medium text-gray-600">Staff member</th>
                    <th className="text-right py-2 px-4 font-medium text-gray-600">Views</th>
                    <th className="text-right py-2 pl-4 font-medium text-gray-600">Last viewed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.byUser30d.map((user) => (
                    <tr key={user.userId}>
                      <td className="py-3 pr-4">
                        <div>
                          <span className="font-medium text-gray-900">{user.name}</span>
                          {user.email && user.email !== user.name && (
                            <span className="block text-xs text-gray-500 mt-0.5">{user.email}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-gray-700">
                        {user.views.toLocaleString()}
                      </td>
                      <td className="py-3 pl-4 text-right text-gray-500">
                        {formatRelativeDate(new Date(user.lastViewedAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              No workflow usage recorded yet.
            </p>
          )}
        </div>
      </div>

      {/* Information Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="flex-none h-5 w-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-900">About this data</p>
            <p className="text-sm text-blue-800 mt-1">
              Workflow views are recorded when staff open guidance pages. This data helps with onboarding support, 
              identifying training needs, and understanding which workflows are most useful. 
              Usage by staff is shown to help admins support their team and ensure everyone has access to the guidance they need.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
