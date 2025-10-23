'use client'

import { useState, useEffect } from 'react'
import { Session } from '@/server/auth'

interface Suggestion {
  id: string
  surgeryId: string | null
  baseId: string | null
  symptom: string
  userEmail: string | null
  text: string
  status: 'pending' | 'actioned' | 'discarded'
  createdAt: string
  updatedAt: string
  surgery: {
    id: string
    name: string
    slug: string | null
  } | null
}

interface SuggestionsData {
  suggestions: Suggestion[]
  unreadCount: number
}

interface SuggestionsAnalyticsProps {
  session: Session
}

export default function SuggestionsAnalytics({ session }: SuggestionsAnalyticsProps) {
  const [suggestionsData, setSuggestionsData] = useState<SuggestionsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'actioned' | 'discarded'>('all')
  const [isUpdating, setIsUpdating] = useState<string | null>(null)

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const params = new URLSearchParams()
        if (statusFilter !== 'all') {
          params.append('status', statusFilter)
        }
        
        const response = await fetch(`/api/suggestions?${params}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch suggestions')
        }
        
        const data = await response.json()
        setSuggestionsData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSuggestions()
  }, [statusFilter])

  const updateSuggestionStatus = async (suggestionId: string, newStatus: 'actioned' | 'discarded') => {
    try {
      setIsUpdating(suggestionId)
      
      const response = await fetch('/api/suggestions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestionId,
          status: newStatus
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to update suggestion')
      }
      
      // Refresh the data
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      
      const refreshResponse = await fetch(`/api/suggestions?${params}`)
      if (refreshResponse.ok) {
        const data = await refreshResponse.json()
        setSuggestionsData(data)
      }
    } catch (err) {
      console.error('Error updating suggestion:', err)
      setError(err instanceof Error ? err.message : 'Failed to update suggestion')
    } finally {
      setIsUpdating(null)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'actioned':
        return 'bg-green-100 text-green-800'
      case 'discarded':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-nhs-dark-blue">
            User Suggestions
          </h2>
          <div className="flex items-center space-x-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              disabled
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="actioned">Actioned</option>
              <option value="discarded">Discarded</option>
            </select>
          </div>
        </div>
        
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-nhs-dark-blue">
          User Suggestions
        </h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-800 font-medium">Error loading suggestions</p>
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
          User Suggestions
        </h2>
        <div className="flex items-center space-x-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="actioned">Actioned</option>
            <option value="discarded">Discarded</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {suggestionsData?.suggestions.length || 0}
            </div>
            <p className="text-sm text-gray-600">Total Suggestions</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {suggestionsData?.suggestions.filter(s => s.status === 'pending').length || 0}
            </div>
            <p className="text-sm text-gray-600">Pending</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {suggestionsData?.suggestions.filter(s => s.status === 'actioned').length || 0}
            </div>
            <p className="text-sm text-gray-600">Actioned</p>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {suggestionsData?.suggestions.filter(s => s.status === 'discarded').length || 0}
            </div>
            <p className="text-sm text-gray-600">Discarded</p>
          </div>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="space-y-4">
        {suggestionsData?.suggestions && suggestionsData.suggestions.length > 0 ? (
          suggestionsData.suggestions.map((suggestion) => (
            <div key={suggestion.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      {suggestion.symptom}
                    </h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(suggestion.status)}`}>
                      {suggestion.status.charAt(0).toUpperCase() + suggestion.status.slice(1)}
                    </span>
                  </div>
                  {session.type === 'superuser' && suggestion.surgery && (
                    <p className="text-sm text-gray-600 mb-2">
                      From: {suggestion.surgery.name}
                    </p>
                  )}
                  {suggestion.userEmail && (
                    <p className="text-sm text-gray-600 mb-2">
                      User: {suggestion.userEmail}
                    </p>
                  )}
                  <p className="text-sm text-gray-500">
                    Submitted: {formatDate(suggestion.createdAt)}
                  </p>
                </div>
                {suggestion.status === 'pending' && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => updateSuggestionStatus(suggestion.id, 'actioned')}
                      disabled={isUpdating === suggestion.id}
                      className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                    >
                      {isUpdating === suggestion.id ? 'Updating...' : 'Mark Actioned'}
                    </button>
                    <button
                      onClick={() => updateSuggestionStatus(suggestion.id, 'discarded')}
                      disabled={isUpdating === suggestion.id}
                      className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm disabled:opacity-50"
                    >
                      {isUpdating === suggestion.id ? 'Updating...' : 'Discard'}
                    </button>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-800 whitespace-pre-wrap">
                  {suggestion.text}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium text-gray-900 mb-2">No suggestions found</p>
            <p className="text-gray-600">
              {statusFilter === 'all' 
                ? 'No suggestions have been submitted yet.'
                : `No suggestions with status "${statusFilter}" found.`
              }
            </p>
          </div>
        )}
      </div>

      {/* Data Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-blue-800 font-medium">About User Suggestions</p>
            <p className="text-blue-700 text-sm mt-1">
              Users can submit suggestions for improving symptoms or adding new ones. 
              {session.type === 'surgery' 
                ? ' You can see suggestions from users in your practice and mark them as actioned or discarded.'
                : ' As a superuser, you can see all suggestions across all practices and manage their status.'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
