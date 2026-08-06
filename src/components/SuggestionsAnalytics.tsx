'use client'

import { useCallback, useEffect, useState } from 'react'
import { Session } from '@/server/auth'
import { AlertBanner, Badge, Button, EmptyState, Select, SkeletonCard } from '@/components/ui'
import type { SuggestionRes, SuggestionStatus } from '@/lib/api-contracts'
import {
  SUGGESTION_STATUS_BADGE_COLORS,
  SUGGESTION_STATUS_LABELS,
  formatSuggestionDate,
} from '@/lib/suggestions'

interface SuggestionsData {
  suggestions: SuggestionRes[]
  unreadCount: number
}

interface SuggestionsAnalyticsProps {
  session: Session
}

type StatusFilter = 'all' | 'PENDING' | 'DONE' | 'DECLINED'

export default function SuggestionsAnalytics({ session }: SuggestionsAnalyticsProps) {
  const [suggestionsData, setSuggestionsData] = useState<SuggestionsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const loadSuggestions = useCallback(async () => {
    const params = new URLSearchParams({ scope: 'surgery' })
    if (statusFilter !== 'all') {
      params.append('status', statusFilter)
    }
    const response = await fetch(`/api/suggestions?${params}`)
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }
    const data = await response.json()
    setSuggestionsData(data)
  }, [statusFilter])

  useEffect(() => {
    let isCancelled = false
    const fetchSuggestions = async () => {
      try {
        setIsLoading(true)
        setError(null)
        await loadSuggestions()
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'An error occurred')
          setSuggestionsData({ suggestions: [], unreadCount: 0 })
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }
    fetchSuggestions()
    return () => {
      isCancelled = true
    }
  }, [loadSuggestions])

  const updateSuggestionStatus = async (suggestionId: string, newStatus: SuggestionStatus) => {
    try {
      setIsUpdating(suggestionId)
      const response = await fetch('/api/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, status: newStatus }),
      })
      if (!response.ok) {
        throw new Error('Failed to update suggestion')
      }
      await loadSuggestions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update suggestion')
    } finally {
      setIsUpdating(null)
    }
  }

  const deleteSuggestion = async (suggestionId: string) => {
    try {
      setIsDeleting(suggestionId)
      const response = await fetch(`/api/suggestions?id=${suggestionId}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error('Failed to delete suggestion')
      }
      await loadSuggestions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete suggestion')
    } finally {
      setIsDeleting(null)
    }
  }

  const getStatusCount = (status: SuggestionStatus) => {
    if (!suggestionsData?.suggestions) return 0
    return suggestionsData.suggestions.filter((s) => s.status === status).length
  }

  const filterSelect = (
    <Select
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
      className="w-auto text-sm"
      disabled={isLoading}
    >
      <option value="all">All Status</option>
      <option value="PENDING">Pending</option>
      <option value="DONE">Done</option>
      <option value="DECLINED">Declined</option>
    </Select>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-nhs-dark-blue">Symptom Suggestions</h2>
          {filterSelect}
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-nhs-dark-blue">Symptom Suggestions</h2>
        <AlertBanner variant="error">
          <p className="font-medium">Error loading suggestions</p>
          <p>{error}</p>
          <Button variant="danger" size="sm" className="mt-3" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </AlertBanner>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-nhs-dark-blue">Symptom Suggestions</h2>
        {filterSelect}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Suggestions', value: suggestionsData?.suggestions.length || 0, className: 'text-gray-900' },
          { label: 'Pending', value: getStatusCount('PENDING'), className: 'text-yellow-600' },
          { label: 'Done', value: getStatusCount('DONE'), className: 'text-green-600' },
          { label: 'Declined', value: getStatusCount('DECLINED'), className: 'text-red-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow-md p-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${stat.className}`}>{stat.value}</div>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </div>
          </div>
        ))}
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
                      {suggestion.symptom || suggestion.title || 'Suggestion'}
                    </h3>
                    <Badge color={SUGGESTION_STATUS_BADGE_COLORS[suggestion.status]} pill>
                      {SUGGESTION_STATUS_LABELS[suggestion.status]}
                    </Badge>
                    {suggestion.redirectedAt ? (
                      <Badge color="blue" pill>
                        Redirected from the toolkit team
                      </Badge>
                    ) : null}
                  </div>
                  {session.type === 'superuser' && suggestion.surgery && (
                    <p className="text-sm text-gray-600 mb-2">From: {suggestion.surgery.name}</p>
                  )}
                  {suggestion.userEmail && (
                    <p className="text-sm text-gray-600 mb-2">User: {suggestion.userEmail}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    Submitted: {formatSuggestionDate(suggestion.createdAt)}
                  </p>
                </div>
                <div className="flex space-x-2">
                  {suggestion.status === 'PENDING' ? (
                    <>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => updateSuggestionStatus(suggestion.id, 'DONE')}
                        loading={isUpdating === suggestion.id}
                      >
                        Mark Done
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => updateSuggestionStatus(suggestion.id, 'DECLINED')}
                        loading={isUpdating === suggestion.id}
                      >
                        Decline
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => updateSuggestionStatus(suggestion.id, 'PENDING')}
                      loading={isUpdating === suggestion.id}
                    >
                      Undo
                    </Button>
                  )}
                  <Button
                    variant="danger-soft"
                    size="sm"
                    onClick={() => deleteSuggestion(suggestion.id)}
                    loading={isDeleting === suggestion.id}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-800 whitespace-pre-wrap">{suggestion.text}</p>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            illustration="clipboard"
            title="No suggestions found"
            description={
              statusFilter === 'all'
                ? 'No symptom suggestions have been submitted yet.'
                : `No suggestions with status "${SUGGESTION_STATUS_LABELS[statusFilter]}" found.`
            }
          />
        )}
      </div>

      {/* Data Info */}
      <AlertBanner variant="info">
        <p className="font-medium">About Symptom Suggestions</p>
        <p className="mt-1">
          Users can submit suggestions for improving symptom information from any symptom page.
          {session.type === 'surgery'
            ? ' You can see suggestions from users in your practice and mark them as done or declined.'
            : ' As a superuser, you can see all symptom suggestions across all practices and manage their status.'}
          {' '}App feature requests and bug reports are triaged separately in System management —
          but when one of those turns out to be about your own practice&apos;s toolkit, the
          Signposting team redirects it here, marked &quot;Redirected from the toolkit team&quot;.
        </p>
      </AlertBanner>
    </div>
  )
}
