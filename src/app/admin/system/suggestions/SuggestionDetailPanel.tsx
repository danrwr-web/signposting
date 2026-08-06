'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { AlertBanner, Badge, Button, Dialog, FormField, Select, Textarea } from '@/components/ui'
import type { SuggestionStatus } from '@/lib/api-contracts'
import {
  SUGGESTION_STATUSES,
  SUGGESTION_STATUS_BADGE_COLORS,
  SUGGESTION_STATUS_LABELS,
  SUGGESTION_TYPE_BADGE_COLORS,
  SUGGESTION_TYPE_LABELS,
  formatSuggestionDate,
} from '@/lib/suggestions'
import type { TriageSuggestion } from './types'

interface SuggestionDetailPanelProps {
  suggestion: TriageSuggestion | null
  onClose: () => void
  onSaved: () => void
}

export default function SuggestionDetailPanel({
  suggestion,
  onClose,
  onSaved,
}: SuggestionDetailPanelProps) {
  const [status, setStatus] = useState<SuggestionStatus>('PENDING')
  const [response, setResponse] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRedirectMode, setIsRedirectMode] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Sync form state when a (different) suggestion is opened.
  useEffect(() => {
    if (suggestion) {
      setStatus(suggestion.status)
      setResponse(suggestion.response || '')
      setIsRedirectMode(false)
    }
  }, [suggestion])

  if (!suggestion) {
    return null
  }

  const canRedirect = Boolean(suggestion.surgeryId) && suggestion.type !== 'SYMPTOM_CONTENT'

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const body: { status: SuggestionStatus; response?: string } = { status }
      if (response.trim() !== (suggestion.response || '')) {
        body.response = response.trim()
      }
      const res = await fetch(`/api/super/suggestions/${suggestion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        throw new Error('Failed to update suggestion')
      }
      toast.success('Suggestion updated')
      onSaved()
      onClose()
    } catch {
      toast.error('Failed to update suggestion')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRedirect = async () => {
    setIsRedirecting(true)
    try {
      const body: { redirectToPractice: true; response?: string } = { redirectToPractice: true }
      // Match handleSave: send any change, including an explicit empty string —
      // omitting a cleared note would silently keep the stored response.
      if (response.trim() !== (suggestion.response || '')) {
        body.response = response.trim()
      }
      const res = await fetch(`/api/super/suggestions/${suggestion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to redirect suggestion')
      }
      toast.success(
        `Redirected to ${suggestion.surgery?.name || 'the practice'}’s toolkit administrators`
      )
      onSaved()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to redirect suggestion')
    } finally {
      setIsRedirecting(false)
    }
  }

  const startRedirect = () => {
    // Offer a starting point for the note the submitter will see, but let the
    // superuser edit or clear it before confirming.
    if (!response.trim()) {
      setResponse(
        'This looks like a request for your own practice rather than the toolkit development team, so we’ve passed it to your practice’s toolkit administrators to review.'
      )
    }
    setIsRedirectMode(true)
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this suggestion permanently? This cannot be undone.')) {
      return
    }
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/super/suggestions/${suggestion.id}`, { method: 'DELETE' })
      if (!res.ok) {
        throw new Error('Failed to delete suggestion')
      }
      toast.success('Suggestion deleted')
      onSaved()
      onClose()
    } catch {
      toast.error('Failed to delete suggestion')
    } finally {
      setIsDeleting(false)
    }
  }

  const submitter =
    suggestion.submittedBy?.name || suggestion.submittedBy?.email || suggestion.userEmail || 'Unknown'

  return (
    <Dialog
      open
      onClose={onClose}
      title={suggestion.title || suggestion.symptom || 'Suggestion'}
      width="2xl"
      footer={
        isRedirectMode ? (
          <>
            <Button
              variant="secondary"
              onClick={() => setIsRedirectMode(false)}
              disabled={isRedirecting}
            >
              Back
            </Button>
            <Button onClick={handleRedirect} loading={isRedirecting}>
              Confirm redirect
            </Button>
          </>
        ) : (
          <>
            <Button variant="danger-soft" onClick={handleDelete} loading={isDeleting}>
              Delete
            </Button>
            {canRedirect && (
              <Button variant="secondary" onClick={startRedirect} disabled={isSaving}>
                Redirect to practice admins
              </Button>
            )}
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              Save changes
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={SUGGESTION_TYPE_BADGE_COLORS[suggestion.type]}>
            {SUGGESTION_TYPE_LABELS[suggestion.type]}
          </Badge>
          <Badge color={SUGGESTION_STATUS_BADGE_COLORS[suggestion.status]} pill>
            {SUGGESTION_STATUS_LABELS[suggestion.status]}
          </Badge>
          <span className="ml-auto text-xs text-nhs-grey">
            Submitted {formatSuggestionDate(suggestion.createdAt)}
          </span>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted by</dt>
            <dd className="text-gray-900">{submitter}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Surgery</dt>
            <dd className="text-gray-900">{suggestion.surgery?.name || '—'}</dd>
          </div>
          {suggestion.symptom ? (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Symptom</dt>
              <dd className="text-gray-900">
                {suggestion.baseId ? (
                  // Surgery context is required to resolve custom symptoms and
                  // show the practice's own overrides rather than base wording.
                  <Link
                    href={`/symptom/${suggestion.baseId}${
                      suggestion.surgeryId ? `?surgery=${suggestion.surgeryId}` : ''
                    }`}
                    className="text-nhs-blue hover:text-nhs-dark-blue underline"
                  >
                    {suggestion.symptom}
                  </Link>
                ) : (
                  suggestion.symptom
                )}
              </dd>
            </div>
          ) : null}
          {suggestion.pageContext ? (
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Page</dt>
              <dd className="text-gray-900 break-all">{suggestion.pageContext}</dd>
            </div>
          ) : null}
        </dl>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{suggestion.text}</p>
        </div>

        {suggestion.redirectedAt && suggestion.redirectedFromType ? (
          <AlertBanner variant="info">
            Redirected to the practice&apos;s toolkit administrators on{' '}
            {formatSuggestionDate(suggestion.redirectedAt)} (originally submitted as a{' '}
            {SUGGESTION_TYPE_LABELS[suggestion.redirectedFromType].toLowerCase()}).
          </AlertBanner>
        ) : null}

        {isRedirectMode ? (
          <AlertBanner variant="warning">
            <span>
              This will move the suggestion to{' '}
              <strong>{suggestion.surgery?.name || 'the practice'}&apos;s toolkit
              administrators</strong>. It will appear as a new pending item on their Suggestions
              tab and leave this triage queue. The submitter will see the note below on their My
              suggestions page.
            </span>
          </AlertBanner>
        ) : (
          <FormField label="Status" htmlFor="triage-status">
            <Select
              id="triage-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as SuggestionStatus)}
            >
              {SUGGESTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {SUGGESTION_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
        )}

        <FormField
          label={isRedirectMode ? 'Note to submitter' : 'Response to submitter'}
          htmlFor="triage-response"
        >
          <Textarea
            id="triage-response"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Visible to the submitter on their My suggestions page."
          />
        </FormField>

        {suggestion.respondedBy && suggestion.respondedAt ? (
          <p className="text-xs text-nhs-grey">
            Last response by {suggestion.respondedBy.name || suggestion.respondedBy.email} on{' '}
            {formatSuggestionDate(suggestion.respondedAt)}.
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}
