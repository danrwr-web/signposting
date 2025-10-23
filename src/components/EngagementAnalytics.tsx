'use client'

import { useState, useEffect } from 'react'
import { Session } from '@/server/auth'

interface EngagementData {
  topSymptoms: Array<{
    id: string
    name: string
    ageGroup: string
    viewCount: number
  }>
  topUsers: Array<{
    userEmail: string
    engagementCount: number
  }>
  surgeryBreakdown?: Array<{
    surgeryId: string
    surgeryName: string
    surgerySlug: string | null
    engagementCount: number
  }>
}

interface EngagementAnalyticsProps {
  session: Session
  surgeries?: Array<{
    id: string
    name: string
    slug: string | null
  }>
}

export default function EngagementAnalytics({ session, surgeries = [] }: EngagementAnalyticsProps) {
  const [engagementData, setEngagementData] = useState<EngagementData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [limit, setLimit] = useState(10)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedSurgeryId, setSelectedSurgeryId] = useState<string>('all')

  useEffect(() => {
    const fetchEngagementData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const params = new URLSearchParams({
          limit: limit.toString(),
        })
        
        // Add date range filter
        if (dateRange !== 'all') {
          const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
          const startDate = new Date()
          startDate.setDate(startDate.getDate() - days)
          params.append('startDate', startDate.toISOString())
        }
        
        // Add surgery filter
        if (session.type === 'surgery' && session.surgeryId) {
          // Surgery admins see only their surgery's data
          params.append('surgeryId', session.surgeryId)
        } else if (session.type === 'superuser' && selectedSurgeryId !== 'all') {
          // Superusers can drill down to specific surgeries
          params.append('surgeryId', selectedSurgeryId)
        }
        
        // Include surgery breakdown for superusers
        if (session.type === 'superuser') {
          params.append('includeSurgeryBreakdown', 'true')
        }
        
        const response = await fetch(`/api/engagement/top?${params}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch engagement data')
        }
        
        const data = await response.json()
        setEngagementData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchEngagementData()
  }, [session, limit, dateRange, selectedSurgeryId])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-nhs-dark-blue">
            Engagement Analytics
          </h2>
        <div className="flex items-center space-x-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d' | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            disabled
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            disabled
          >
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
          </select>
        </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-4"></div>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-12"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded mb-4"></div>
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-12"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-nhs-dark-blue">
          Engagement Analytics
        </h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-800 font-medium">Error loading engagement data</p>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-nhs-dark-blue">
          Engagement Analytics
        </h2>
        <div className="flex items-center space-x-4">
          {session.type === 'superuser' && surgeries.length > 0 && (
            <select
              value={selectedSurgeryId}
              onChange={(e) => setSelectedSurgeryId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
            >
              <option value="all">All Surgeries</option>
              {surgeries.map((surgery) => (
                <option key={surgery.id} value={surgery.id}>
                  {surgery.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d' | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
          >
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
          </select>
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 bg-nhs-green text-white rounded-md hover:bg-green-600 transition-colors text-sm"
          >
            Export Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Symptoms */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Most Viewed Symptoms
          </h3>
          {engagementData?.topSymptoms && engagementData.topSymptoms.length > 0 ? (
            <div className="space-y-3">
              {engagementData.topSymptoms.map((symptom, index) => (
                <div key={symptom.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-500">
                        #{index + 1}
                      </span>
                      <h4 className="text-sm font-medium text-gray-900">
                        {symptom.name}
                      </h4>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        symptom.ageGroup === 'Adult' 
                          ? 'bg-blue-100 text-blue-800'
                          : symptom.ageGroup === 'O5'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {symptom.ageGroup}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold text-nhs-blue">
                      {symptom.viewCount}
                    </span>
                    <p className="text-xs text-gray-500">views</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p>No engagement data available</p>
            </div>
          )}
        </div>

        {/* Top Users */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Most Active Users
          </h3>
          {engagementData?.topUsers && engagementData.topUsers.length > 0 ? (
            <div className="space-y-3">
              {engagementData.topUsers.map((user, index) => (
                <div key={user.userEmail} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-500">
                        #{index + 1}
                      </span>
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {user.userEmail}
                      </h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold text-nhs-green">
                      {user.engagementCount}
                    </span>
                    <p className="text-xs text-gray-500">interactions</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <p>No user engagement data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Surgery Breakdown - Only for Superusers */}
      {session.type === 'superuser' && engagementData?.surgeryBreakdown && engagementData.surgeryBreakdown.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Surgery Breakdown
          </h3>
          <div className="space-y-3">
            {engagementData.surgeryBreakdown.map((surgery, index) => (
              <div key={surgery.surgeryId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-500">
                      #{index + 1}
                    </span>
                    <h4 className="text-sm font-medium text-gray-900">
                      {surgery.surgeryName}
                    </h4>
                    <button
                      onClick={() => setSelectedSurgeryId(surgery.surgeryId)}
                      className="text-xs text-nhs-blue hover:text-blue-700 underline"
                    >
                      View Details
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-semibold text-purple-600">
                    {surgery.engagementCount}
                  </span>
                  <p className="text-xs text-gray-500">interactions</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Summary Statistics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-nhs-blue">
              {engagementData?.topSymptoms.reduce((sum, symptom) => sum + symptom.viewCount, 0) || 0}
            </div>
            <p className="text-sm text-gray-600 mt-1">Total Symptom Views</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-nhs-green">
              {engagementData?.topUsers.length || 0}
            </div>
            <p className="text-sm text-gray-600 mt-1">Active Users</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {session.type === 'superuser' && engagementData?.surgeryBreakdown 
                ? engagementData.surgeryBreakdown.length 
                : engagementData?.topSymptoms.length || 0}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {session.type === 'superuser' ? 'Active Surgeries' : 'Symptoms Accessed'}
            </p>
          </div>
        </div>
      </div>

      {/* Data Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-blue-800 font-medium">About Engagement Analytics</p>
            <p className="text-blue-700 text-sm mt-1">
              This data shows symptom views and user activity. Data is collected when users view symptom pages.
              {session.type === 'surgery' 
                ? ' Data is filtered to show only activity for your surgery.' 
                : session.type === 'superuser' 
                ? ' As a superuser, you can view system-wide data and drill down by surgery using the dropdown above.'
                : ''
              }
            </p>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Export Engagement Data
            </h3>
            <p className="text-gray-600 mb-4">
              Export the current engagement data as a CSV file for further analysis.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // TODO: Implement CSV export functionality
                  const csvData = generateCSVData()
                  downloadCSV(csvData, `engagement-data-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`)
                  setShowExportModal(false)
                }}
                className="px-4 py-2 bg-nhs-green text-white rounded-md hover:bg-green-600 transition-colors"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper functions for CSV export
function generateCSVData() {
  // This would generate CSV data from the engagement data
  // For now, return a placeholder
  return "Symptom,Views,Age Group\nChest Pain,25,Adult\nDifficulty Breathing,18,Adult"
}

function downloadCSV(csvData: string, filename: string) {
  const blob = new Blob([csvData], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
