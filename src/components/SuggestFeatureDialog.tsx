'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { AlertBanner, Button, Dialog, FormField, Input, Select, Textarea } from '@/components/ui'
import type { SuggestionType } from '@/lib/api-contracts'
import { SUGGESTION_TYPE_LABELS } from '@/lib/suggestions'

/**
 * Where the user wants their message to go. Only the first two are actually
 * deliverable through this form; 'practice-team' exists so we can catch
 * questions meant for the user's own practice staff and redirect them
 * before anything is submitted to the wrong place.
 */
type SuggestionAudience = 'toolkit' | 'practice-guidance' | 'practice-team'

interface SuggestFeatureDialogProps {
  open: boolean
  onClose: () => void
  /** Pre-selected suggestion type. Defaults to FEATURE. */
  defaultType?: SuggestionType
  surgeryId?: string
  /** When set, the dialog offers (and pre-selects) the "Symptom content" type. */
  symptomContext?: { baseId?: string; symptomName: string }
  /** Called after a suggestion has been submitted successfully. */
  onSubmitted?: () => void
}

const FORM_ID = 'suggest-feature-form'

interface AudienceOption {
  value: SuggestionAudience
  label: string
  description: string
}

export default function SuggestFeatureDialog({
  open,
  onClose,
  defaultType,
  surgeryId,
  symptomContext,
  onSubmitted,
}: SuggestFeatureDialogProps) {
  const pathname = usePathname()
  const initialFocusRef = useRef<HTMLInputElement>(null)
  const wantsPracticeGuidance = defaultType === 'SYMPTOM_CONTENT' || Boolean(symptomContext)
  // No default audience: users kept submitting practice matters to the toolkit
  // team when a destination was pre-selected, so the form now stays hidden
  // until they actively choose one. Symptom-page entry points are the
  // exception — there the destination is unambiguous.
  const initialAudience: SuggestionAudience | null =
    wantsPracticeGuidance && surgeryId ? 'practice-guidance' : null
  const initialType: SuggestionType =
    defaultType && defaultType !== 'SYMPTOM_CONTENT' ? defaultType : 'FEATURE'

  const [audience, setAudience] = useState<SuggestionAudience | null>(initialAudience)
  const [type, setType] = useState<SuggestionType>(initialType)
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [text, setText] = useState('')
  const [titleError, setTitleError] = useState(false)
  const [topicError, setTopicError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset the form whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setAudience(initialAudience)
      setType(initialType)
      setTitle('')
      setTopic('')
      setText('')
      setTitleError(false)
      setTopicError(false)
    }
  }, [open, initialAudience, initialType])

  // Practice destinations come first: most misdirected suggestions are practice
  // matters sent to the toolkit team, so the practice options get first refusal.
  const audienceOptions: AudienceOption[] = [
    // Symptom-content suggestions are routed to surgery admins, so this option
    // only makes sense inside a surgery.
    ...(surgeryId
      ? [
          {
            value: 'practice-guidance' as const,
            label: 'Your practice’s toolkit administrators',
            description:
              'New or amended local guidance, symptom content or services in your practice’s own toolkit.',
          },
        ]
      : []),
    {
      value: 'practice-team',
      label: 'Your practice’s management or clinical team',
      description:
        'A question about your own practice’s policies, procedures or clinical processes.',
    },
    {
      value: 'toolkit',
      label: 'The Signposting Toolkit team',
      description:
        'Ideas, improvements or bug reports about the toolkit software itself — not about your practice.',
    },
  ]

  const isPracticeGuidance = audience === 'practice-guidance'
  const isPracticeTeam = audience === 'practice-team'
  const needsTitle = audience === 'toolkit'
  const needsTopic = isPracticeGuidance && !symptomContext

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!audience || isPracticeTeam) return
    if (needsTitle && !title.trim()) {
      setTitleError(true)
      return
    }
    if (needsTopic && !topic.trim()) {
      setTopicError(true)
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isPracticeGuidance ? 'SYMPTOM_CONTENT' : type,
          title: needsTitle ? title.trim() : undefined,
          text: text.trim(),
          surgeryId,
          baseId: isPracticeGuidance ? symptomContext?.baseId : undefined,
          symptom: isPracticeGuidance
            ? symptomContext?.symptomName ?? topic.trim()
            : undefined,
          pageContext: pathname ?? undefined,
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to submit suggestion')
      }
      const destination = isPracticeGuidance
        ? 'your practice’s toolkit administrators'
        : 'the Signposting Toolkit team'
      toast.success(
        surgeryId ? (
          <span>
            Sent to {destination}. Track it under{' '}
            <a href={`/s/${surgeryId}/suggestions`} className="font-semibold underline">
              My suggestions
            </a>
            .
          </span>
        ) : (
          `Sent to ${destination}. Thank you!`
        )
      )
      onClose()
      onSubmitted?.()
    } catch {
      toast.error('Failed to submit suggestion. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Send a suggestion"
      description="First, choose who your message is for, so it reaches the right team."
      width="md"
      initialFocusRef={initialFocusRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {isPracticeTeam ? 'Close' : 'Cancel'}
          </Button>
          {audience !== null && !isPracticeTeam && (
            <Button type="submit" form={FORM_ID} loading={isSubmitting}>
              Submit suggestion
            </Button>
          )}
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <fieldset>
          <legend className="block text-sm font-medium text-gray-700 mb-2">
            Who is your message for?
          </legend>
          <div className="space-y-2">
            {audienceOptions.map((option, index) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  audience === option.value
                    ? 'border-nhs-blue bg-blue-50 ring-1 ring-nhs-blue'
                    : 'border-gray-300 hover:border-nhs-blue'
                }`}
              >
                <input
                  ref={index === 0 ? initialFocusRef : undefined}
                  type="radio"
                  name="suggestion-audience"
                  value={option.value}
                  checked={audience === option.value}
                  onChange={() => setAudience(option.value)}
                  className="mt-1 h-4 w-4 text-nhs-blue focus:ring-nhs-blue"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                  <span className="block text-xs text-nhs-grey">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {audience === 'toolkit' && (
          <>
            <AlertBanner variant="info">
              This goes to the <strong>Signposting Toolkit development team</strong> — not to
              anyone at your practice. Please don&apos;t include patient details or questions
              meant for your own practice staff.
              {surgeryId ? (
                <>
                  {' '}If your suggestion turns out to be about your practice&apos;s own toolkit,
                  we&apos;ll pass it on to your practice&apos;s administrators.
                </>
              ) : null}
            </AlertBanner>

            <FormField label="What kind of suggestion is this?" htmlFor="suggestion-type">
              <Select
                id="suggestion-type"
                value={type}
                onChange={(e) => setType(e.target.value as SuggestionType)}
              >
                <option value="FEATURE">{SUGGESTION_TYPE_LABELS.FEATURE}</option>
                <option value="IMPROVEMENT">{SUGGESTION_TYPE_LABELS.IMPROVEMENT}</option>
                <option value="BUG">{SUGGESTION_TYPE_LABELS.BUG}</option>
              </Select>
            </FormField>

            <FormField
              label="Title"
              htmlFor="suggestion-title"
              required
              error={titleError ? 'Please enter a short title' : undefined}
            >
              <Input
                id="suggestion-title"
                value={title}
                maxLength={150}
                error={titleError}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (titleError && e.target.value.trim()) setTitleError(false)
                }}
                placeholder="A short summary of your idea"
              />
            </FormField>
          </>
        )}

        {isPracticeGuidance && (
          <>
            <AlertBanner variant="info">
              This goes to <strong>your practice&apos;s toolkit administrators</strong>, who
              review suggestions for local guidance and symptom content.
            </AlertBanner>

            {symptomContext ? (
              <p className="text-sm text-nhs-grey">
                For: <span className="font-medium">{symptomContext.symptomName}</span>
              </p>
            ) : (
              <FormField
                label="Which symptom or guidance area is this about?"
                htmlFor="suggestion-topic"
                required
                error={topicError ? 'Please say which symptom or guidance this is about' : undefined}
              >
                <Input
                  id="suggestion-topic"
                  value={topic}
                  maxLength={300}
                  error={topicError}
                  onChange={(e) => {
                    setTopic(e.target.value)
                    if (topicError && e.target.value.trim()) setTopicError(false)
                  }}
                  placeholder="e.g. Chest pain, or a local service that has changed"
                />
              </FormField>
            )}
          </>
        )}

        {isPracticeTeam && (
          <AlertBanner variant="warning">
            <span>
              <strong>This form can&apos;t reach your practice&apos;s management, safeguarding
              or clinical leads.</strong>{' '}
              For questions about your own practice&apos;s policies, procedures or clinical
              processes — for example triage or safeguarding arrangements — please contact your
              practice manager or clinical lead directly, in your practice&apos;s usual way.
            </span>
          </AlertBanner>
        )}

        {audience !== null && !isPracticeTeam && (
          <>
            <FormField label="Details" htmlFor="suggestion-text" required>
              <Textarea
                id="suggestion-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                maxLength={5000}
                required
                placeholder={
                  isPracticeGuidance
                    ? 'Please describe the change to your practice’s guidance...'
                    : 'Describe your idea and the problem it would solve...'
                }
              />
            </FormField>

            <p className="text-xs text-nhs-grey">
              We&apos;ll include the page you&apos;re on to help us understand the context.
            </p>
          </>
        )}
      </form>
    </Dialog>
  )
}
