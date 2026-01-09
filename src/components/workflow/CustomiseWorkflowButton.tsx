'use client'

import { useState, useTransition } from 'react'
import { createWorkflowOverride } from '@/app/s/[id]/workflow/actions'
import { useRouter } from 'next/navigation'

interface CustomiseWorkflowButtonProps {
  surgeryId: string
  globalTemplateId: string
  workflowName: string
}

export function CustomiseWorkflowButton({
  surgeryId,
  globalTemplateId,
  workflowName,
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
        className="text-sm text-gray-600 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Creating...' : 'Customise for this surgery'}
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  )
}

