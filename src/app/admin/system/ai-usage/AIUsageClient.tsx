'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import SimpleHeader from '@/components/SimpleHeader'

interface RouteUsage {
  route: string
  calls: number
  promptTokens: number
  completionTokens: number
  costUsd: number
  costGbp: number
}

interface OverallUsage {
  calls: number
  promptTokens: number
  completionTokens: number
  costUsd: number
  costGbp: number
}

interface PeriodUsage {
  byRoute: RouteUsage[]
  overall: OverallUsage
}

interface AIUsageData {
  last7days: PeriodUsage
  last30days: PeriodUsage
}

export default function AIUsageClient() {
  const [aiUsageData, setAiUsageData] = useState<AIUsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/aiUsageSummary')
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setError('Superuser access required.')
            return
          }
          setError('Usage data not available.')
          return
        }
        const data = await res.json()
        setAiUsageData(data)
      } catch {
        setError('Usage data not available.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const formatRouteName = (route: string): string => {
    if (route === 'improveInstruction') return 'Improve wording'
    if (route === 'explainInstruction') return 'Explain rule'
    return route
  }

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={[]} currentSurgeryId={undefined} />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8">
          <nav className="text-sm text-nhs-grey mb-2">
            <Link href="/admin" className="hover:text-nhs-blue">
              Practice admin
            </Link>
            <span className="mx-2">/</span>
            <Link href="/admin/system" className="hover:text-nhs-blue">
              System management
            </Link>
            <span className="mx-2">/</span>
            <span>AI usage & cost</span>
          </nav>
          <h1 className="text-3xl font-bold text-nhs-dark-blue">
            AI usage & cost
          </h1>
          <p className="text-nhs-grey mt-2">
            Monitor AI usage and estimated costs across all surgeries and features.
          </p>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-flex items-center px-4 py-2 bg-white rounded-lg shadow">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-nhs-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-nhs-grey">Loading usage data...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {!loading && !error && aiUsageData && (
          <div className="space-y-6">
            {/* Last 7 Days */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">
                Last 7 days
              </h2>
              <div className="mb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-nhs-light-grey rounded-lg p-4">
                    <p className="text-sm text-nhs-grey">Total Calls</p>
                    <p className="text-2xl font-semibold text-nhs-dark-blue">{aiUsageData.last7days.overall.calls}</p>
                  </div>
                  <div className="bg-nhs-light-grey rounded-lg p-4">
                    <p className="text-sm text-nhs-grey">Tokens In</p>
                    <p className="text-2xl font-semibold text-nhs-dark-blue">{aiUsageData.last7days.overall.promptTokens.toLocaleString()}</p>
                  </div>
                  <div className="bg-nhs-light-grey rounded-lg p-4">
                    <p className="text-sm text-nhs-grey">Tokens Out</p>
                    <p className="text-2xl font-semibold text-nhs-dark-blue">{aiUsageData.last7days.overall.completionTokens.toLocaleString()}</p>
                  </div>
                  <div className="bg-nhs-light-grey rounded-lg p-4">
                    <p className="text-sm text-nhs-grey">Estimated Cost</p>
                    <p className="text-2xl font-semibold text-nhs-blue">£{aiUsageData.last7days.overall.costGbp.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              {aiUsageData.last7days.byRoute.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Route
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Calls
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tokens In
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tokens Out
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estimated Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {aiUsageData.last7days.byRoute.map((routeData) => (
                        <tr key={routeData.route}>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatRouteName(routeData.route)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {routeData.calls}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {routeData.promptTokens.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {routeData.completionTokens.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            £{routeData.costGbp.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-nhs-grey text-sm">No usage data for this period.</p>
              )}
            </div>

            {/* Last 30 Days */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">
                Last 30 days
              </h2>
              <div className="mb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-nhs-light-grey rounded-lg p-4">
                    <p className="text-sm text-nhs-grey">Total Calls</p>
                    <p className="text-2xl font-semibold text-nhs-dark-blue">{aiUsageData.last30days.overall.calls}</p>
                  </div>
                  <div className="bg-nhs-light-grey rounded-lg p-4">
                    <p className="text-sm text-nhs-grey">Tokens In</p>
                    <p className="text-2xl font-semibold text-nhs-dark-blue">{aiUsageData.last30days.overall.promptTokens.toLocaleString()}</p>
                  </div>
                  <div className="bg-nhs-light-grey rounded-lg p-4">
                    <p className="text-sm text-nhs-grey">Tokens Out</p>
                    <p className="text-2xl font-semibold text-nhs-dark-blue">{aiUsageData.last30days.overall.completionTokens.toLocaleString()}</p>
                  </div>
                  <div className="bg-nhs-light-grey rounded-lg p-4">
                    <p className="text-sm text-nhs-grey">Estimated Cost</p>
                    <p className="text-2xl font-semibold text-nhs-blue">£{aiUsageData.last30days.overall.costGbp.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              {aiUsageData.last30days.byRoute.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Route
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Calls
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tokens In
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tokens Out
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estimated Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {aiUsageData.last30days.byRoute.map((routeData) => (
                        <tr key={routeData.route}>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatRouteName(routeData.route)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {routeData.calls}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {routeData.promptTokens.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {routeData.completionTokens.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            £{routeData.costGbp.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-nhs-grey text-sm">No usage data for this period.</p>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8">
          <Link
            href="/admin/system"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-nhs-grey hover:bg-gray-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to System management
          </Link>
        </div>
      </main>
    </div>
  )
}
