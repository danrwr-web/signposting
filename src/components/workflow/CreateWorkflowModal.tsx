'use client'

import { useState } from 'react'

interface CreateWorkflowModalProps {
  isOpen: boolean
  onClose: () => void
  surgeryId: string
}

type WorkflowType = 'PRIMARY' | 'SUPPORTING' | 'MODULE'

export default function CreateWorkflowModal({ isOpen, onClose, surgeryId }: CreateWorkflowModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [workflowType, setWorkflowType] = useState<WorkflowType>('SUPPORTING')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Workflow name is required')
      return
    }
    if (trimmedName.toLowerCase() === 'new workflow') {
      setError('Please enter a specific workflow name')
      return
    }

    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('name', trimmedName)
      formData.append('description', description.trim() || '')
      formData.append('isActive', isActive ? 'true' : 'false')
      formData.append('workflowType', workflowType)

      const response = await fetch(`/api/workflow/create?SurgeryId=${surgeryId}`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create workflow')
      }

      const data = await response.json()
      
      // Redirect to diagram editor
      window.location.href = `/s/${surgeryId}/workflow/templates/${data.templateId}/view`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow')
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setName('')
      setDescription('')
      setIsActive(true)
      setWorkflowType('SUPPORTING')
      setError(null)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" onClick={handleClose}>
      <div className="relative top-20 mx-auto p-0 border w-full max-w-2xl shadow-xl rounded-lg bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Create workflow</h3>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md disabled:opacity-50"
            >
              <span className="sr-only">Close</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Name - Required */}
            <div className="mb-6">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="e.g. Discharge Summaries"
              />
            </div>

            {/* Description - Optional */}
            <div className="mb-6">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="Brief description of what this workflow covers"
              />
            </div>

            {/* Workflow Type - Required */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Workflow type <span className="text-red-500">*</span>
              </label>
              <div className="space-y-3">
                <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="workflowType"
                    value="PRIMARY"
                    checked={workflowType === 'PRIMARY'}
                    onChange={(e) => setWorkflowType(e.target.value as WorkflowType)}
                    disabled={isSubmitting}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Primary workflow</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Main entry point for a document process (e.g. Discharge Summaries)
                    </div>
                  </div>
                </label>
                <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="workflowType"
                    value="SUPPORTING"
                    checked={workflowType === 'SUPPORTING'}
                    onChange={(e) => setWorkflowType(e.target.value as WorkflowType)}
                    disabled={isSubmitting}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Supporting workflow</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Usually accessed directly, but not the main entry point
                    </div>
                  </div>
                </label>
                <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="workflowType"
                    value="MODULE"
                    checked={workflowType === 'MODULE'}
                    onChange={(e) => setWorkflowType(e.target.value as WorkflowType)}
                    disabled={isSubmitting}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Linked module</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Normally accessed from within another workflow (e.g. Blood Tests)
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Active - Optional */}
            <div className="mb-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={isSubmitting}
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Active (workflow will be visible to staff)</span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create & open diagram'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

