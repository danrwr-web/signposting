'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ActionResult } from '../actions'

interface Template {
  id: string
  name: string
  description: string | null
}

interface StartWorkflowClientProps {
  surgeryId: string
  surgeryName: string
  templates: Template[]
  startAction: (formData: FormData) => Promise<ActionResult & { instanceId?: string }>
  initialError?: string
}

export default function StartWorkflowClient({
  surgeryId,
  surgeryName,
  templates,
  startAction,
  initialError,
}: StartWorkflowClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | undefined>(initialError)

  const handleSubmit = async (formData: FormData) => {
    setError(undefined)
    startTransition(async () => {
      const result = await startAction(formData)
      if (result.success && result.instanceId) {
        router.push(`/s/${surgeryId}/workflow/instances/${result.instanceId}`)
      } else {
        setError(result.error || 'Failed to start workflow')
      }
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Start Workflow (Admin / Beta)
        </h1>
        <p className="text-gray-600">
          {surgeryName}
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <form action={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="templateId" className="block text-sm font-medium text-gray-700 mb-2">
              Select Workflow Template
            </label>
            <select
              id="templateId"
              name="templateId"
              required
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="">-- Select a template --</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className="mt-2 text-sm text-gray-500">
                No active workflow templates available. <Link href={`/s/${surgeryId}/workflow/templates`} className="text-blue-600 underline">Create one</Link> to get started.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-2">
              Reference (optional)
            </label>
            <input
              type="text"
              id="reference"
              name="reference"
              placeholder="e.g., Cardiology 11/12/25 – JS"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Category (optional)
            </label>
            <input
              type="text"
              id="category"
              name="category"
              placeholder="e.g., Hospital Letter, Result"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>

          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={isPending || templates.length === 0}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Starting...' : 'Start Workflow'}
            </button>
            <Link
              href={`/s/${surgeryId}/workflow`}
              className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

