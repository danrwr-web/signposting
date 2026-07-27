'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Button, Dialog, FormField, Input, Select, Textarea } from '@/components/ui'
import type { SuggestionType } from '@/lib/api-contracts'
import { SUGGESTION_TYPE_LABELS } from '@/lib/suggestions'

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

export default function SuggestFeatureDialog({
  open,
  onClose,
  defaultType,
  surgeryId,
  symptomContext,
  onSubmitted,
}: SuggestFeatureDialogProps) {
  const pathname = usePathname()
  const initialFocusRef = useRef<HTMLSelectElement>(null)
  const initialType = defaultType ?? (symptomContext ? 'SYMPTOM_CONTENT' : 'FEATURE')
  const [type, setType] = useState<SuggestionType>(initialType)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [titleError, setTitleError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset the form whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setType(initialType)
      setTitle('')
      setText('')
      setTitleError(false)
    }
  }, [open, initialType])

  const needsTitle = type !== 'SYMPTOM_CONTENT'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (needsTitle && !title.trim()) {
      setTitleError(true)
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: needsTitle ? title.trim() : undefined,
          text: text.trim(),
          surgeryId,
          baseId: type === 'SYMPTOM_CONTENT' ? symptomContext?.baseId : undefined,
          symptom: type === 'SYMPTOM_CONTENT' ? symptomContext?.symptomName : undefined,
          pageContext: pathname ?? undefined,
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to submit suggestion')
      }
      toast.success(
        surgeryId ? (
          <span>
            Thank you! Track it under{' '}
            <a href={`/s/${surgeryId}/suggestions`} className="font-semibold underline">
              My suggestions
            </a>
            .
          </span>
        ) : (
          'Thank you for your suggestion!'
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
      title="Suggest a feature or improvement"
      description="Tell us what would make the toolkit better. We read every suggestion."
      width="md"
      initialFocusRef={initialFocusRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={isSubmitting}>
            Submit suggestion
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <FormField label="What kind of suggestion is this?" htmlFor="suggestion-type">
          <Select
            ref={initialFocusRef}
            id="suggestion-type"
            value={type}
            onChange={(e) => setType(e.target.value as SuggestionType)}
          >
            <option value="FEATURE">{SUGGESTION_TYPE_LABELS.FEATURE}</option>
            <option value="IMPROVEMENT">{SUGGESTION_TYPE_LABELS.IMPROVEMENT}</option>
            <option value="BUG">{SUGGESTION_TYPE_LABELS.BUG}</option>
            {symptomContext && (
              <option value="SYMPTOM_CONTENT">{SUGGESTION_TYPE_LABELS.SYMPTOM_CONTENT}</option>
            )}
          </Select>
        </FormField>

        {type === 'SYMPTOM_CONTENT' && symptomContext && (
          <p className="text-sm text-nhs-grey">
            For: <span className="font-medium">{symptomContext.symptomName}</span>
          </p>
        )}

        {needsTitle && (
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
        )}

        <FormField label="Details" htmlFor="suggestion-text" required>
          <Textarea
            id="suggestion-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={5000}
            required
            placeholder={
              type === 'SYMPTOM_CONTENT'
                ? 'Please describe how we can improve this information...'
                : 'Describe your idea and the problem it would solve...'
            }
          />
        </FormField>

        <p className="text-xs text-nhs-grey">
          We&apos;ll include the page you&apos;re on to help us understand the context.
        </p>
      </form>
    </Dialog>
  )
}
