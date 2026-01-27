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

      {/* Information Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="flex-none h-5 w-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-900">About this data</p>
            <p className="text-sm text-blue-800 mt-1">
              This shows aggregated workflow usage across your surgery. Data is collected when staff view workflow guidance pages.
              No individual user activity is tracked or displayed.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
