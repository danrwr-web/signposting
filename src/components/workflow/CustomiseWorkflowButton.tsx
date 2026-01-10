'use client'

import { useState, useTransition } from 'react'
import { createWorkflowOverride } from '@/app/s/[id]/workflow/actions'
import { useRouter } from 'next/navigation'

interface CustomiseWorkflowButtonProps {
  surgeryId: string
  globalTemplateId: string
  workflowName: string
  variant?: 'default' | 'compact'
}

export function CustomiseWorkflowButton({
  surgeryId,
  globalTemplateId,
  workflowName,
  variant = 'default',
}: CustomiseWorkflowButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleCustomise = () => {
    if (!confirm(`Create a customised version of "${workflowName}" for this surgery?`)) {
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await createWorkflowOverride(surgeryId, globalTemplateId)

      if (result.success && result.templateId) {
        // Redirect to the new override's diagram editor
        router.push(`/s/${surgeryId}/workflow/templates/${result.templateId}/view`)
        router.refresh()
      } else {
        setError(result.error || 'Failed to create override')
      }
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCustomise}
        disabled={isPending}
        data-stop-card-nav="true"
        aria-label={`Customise workflow: ${workflowName}`}
        className={
          variant === 'compact'
            ? 'inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-2.5 py-2 transition-colors disabled:opacity-50'
            : 'text-sm text-gray-600 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-3 py-1.5 transition-colors disabled:opacity-50'
        }
      >
        {variant === 'compact' && (
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M16.862 3.487a2.25 2.25 0 0 1 3.182 3.182L8.25 18.463 3 21l2.537-5.25L16.862 3.487Z" />
          </svg>
        )}
        {isPending ? 'Creating…' : variant === 'compact' ? 'Customise' : 'Customise for this surgery'}
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  )
}

