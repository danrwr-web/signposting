'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateWorkflowTemplate, approveWorkflowTemplate } from '../../actions'
import {
  WORKFLOW_ICON_KEYS,
  getWorkflowIcon,
  type WorkflowIconKey,
} from '@/components/workflow/icons/workflowIconRegistry'
import { inferWorkflowIconKey } from '@/components/workflow/icons/inferWorkflowIconKey'

interface WorkflowTemplate {
  id: string
  name: string
  description: string | null
  iconKey: string | null
  colourHex: string | null
  isActive: boolean
  workflowType: string
  approvalStatus: string
  approvedBy: string | null
  approvedAt: Date | null
  lastEditedBy: string | null
  lastEditedAt: Date | null
  sourceTemplateId: string | null
}

interface TemplateEditClientProps {
  surgeryId: string
  templateId: string
  surgeryName: string
  template: WorkflowTemplate
  updateTemplateAction: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  initialError?: string
  initialSuccess?: string
}

export default function TemplateEditClient({
  surgeryId,
  templateId,
  surgeryName,
  template,
  updateTemplateAction,
  initialError,
  initialSuccess,
}: TemplateEditClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | undefined>(initialError)
  const [success, setSuccess] = useState<string | undefined>(initialSuccess)
  const [iconKey, setIconKey] = useState<string>(template.iconKey ?? '')
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [iconSearch, setIconSearch] = useState('')

  const handleTemplateSubmit = async (formData: FormData) => {
    setError(undefined)
    setSuccess(undefined)

    startTransition(async () => {
      const result = await updateTemplateAction(formData)
      if (result.success) {
        setSuccess('Template updated successfully')
        router.refresh()
      } else {
        setError(result.error || 'Failed to update template')
      }
    })
  }

  const inferredIconKey = inferWorkflowIconKey({ name: template.name, description: template.description })
  const iconKeyToPreview = (iconKey || inferredIconKey) as WorkflowIconKey
  const currentIcon = getWorkflowIcon(iconKeyToPreview)

  const filteredIconKeys = WORKFLOW_ICON_KEYS.filter((key) => {
    const def = getWorkflowIcon(key)
    const q = iconSearch.trim().toLowerCase()
    if (!q) return true
    return def.label.toLowerCase().includes(q) || def.tags.some((t) => t.toLowerCase().includes(q))
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-start justify-between mb-2">
            <Link
              href={`/s/${surgeryId}/workflow/templates`}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              ← Back to Templates
            </Link>
            <Link
              href={`/s/${surgeryId}/workflow/templates/${templateId}/view`}
              className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm transition-colors"
            >
              Open diagram
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mt-2">
            Workflow Settings: {template.name}
          </h1>
          <p className="text-gray-600 mt-1">
            {surgeryName}
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {/* Template Details Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Workflow Settings
          </h2>
          <form action={handleTemplateSubmit} className="space-y-4">
            <input type="hidden" name="iconKey" value={iconKey} />
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                defaultValue={template.name}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {/* TODO: colourHex field - currently hidden as it's not used meaningfully in the diagram editor.
                Future use: could be used for diagram accent colours or visual theming in the workflow diagram view. */}
            <input
              type="hidden"
              name="colourHex"
              defaultValue={template.colourHex || ''}
            />
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                defaultValue={template.description || ''}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Icon
              </label>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700 flex-none">
                    <currentIcon.Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {iconKey ? currentIcon.label : `${getWorkflowIcon(inferredIconKey).label} (default)`}
                    </p>
                    <p className="text-xs text-gray-600">
                      Used on the Workflow Guidance landing page.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-none">
                  <button
                    type="button"
                    onClick={() => setIconPickerOpen(true)}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Change…
                  </button>
                  <button
                    type="button"
                    onClick={() => setIconKey('')}
                    className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md"
                    title="Revert to the default icon"
                  >
                    Use default
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="workflowType" className="block text-sm font-medium text-gray-700 mb-1">
                Workflow type *
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="workflowType"
                    value="PRIMARY"
                    defaultChecked={template.workflowType === 'PRIMARY'}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-900">
                    Primary workflow
                    <span className="ml-2 text-xs text-gray-500">
                      Shown in the main workflow list on the Workflow Guidance page.
                    </span>
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="workflowType"
                    value="SUPPORTING"
                    defaultChecked={template.workflowType === 'SUPPORTING' || !template.workflowType}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-900">
                    Supporting workflow
                    <span className="ml-2 text-xs text-gray-500">
                      Shown under Less common / specialist on the Workflow Guidance page.
                    </span>
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="workflowType"
                    value="MODULE"
                    defaultChecked={template.workflowType === 'MODULE'}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-900">
                    Linked module
                    <span className="ml-2 text-xs text-gray-500">
                      Shown as a linked module entry (not a standard workflow card).
                    </span>
                  </span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Controls how this workflow appears on the Workflow Guidance landing page.
              </p>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                defaultChecked={template.isActive}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                Active
              </label>
            </div>
            <div>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </form>
        </div>

        {iconPickerOpen && (
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
            role="dialog"
            aria-modal="true"
            aria-label="Choose an icon"
            onClick={() => setIconPickerOpen(false)}
          >
            <div
              className="relative top-20 mx-auto p-0 border w-full max-w-3xl shadow-xl rounded-lg bg-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Choose an icon</h3>
                    <p className="text-sm text-gray-600 mt-1">Search by name or tag.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIconPickerOpen(false)}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mb-4">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                      placeholder="Search icons…"
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredIconKeys.map((key) => {
                    const def = getWorkflowIcon(key)
                    const selected = key === iconKey
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setIconKey(key)
                          setIconPickerOpen(false)
                        }}
                        className={
                          selected
                            ? 'flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 px-3 py-3 text-left hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                            : 'flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                        }
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 border border-gray-100 text-gray-700 flex-none">
                          <def.Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{def.label}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {filteredIconKeys.length === 0 && (
                  <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4">
                    No icons found. Try a different search term.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Approval Status Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Approval Status
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  template.approvalStatus === 'APPROVED'
                    ? 'bg-green-100 text-green-800'
                    : template.approvalStatus === 'SUPERSEDED'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {template.approvalStatus}
                </span>
                {template.approvalStatus === 'DRAFT' && (
                  <span className="text-xs text-gray-500">
                    (Not visible to staff until approved)
                  </span>
                )}
              </div>
            </div>

            {template.approvalStatus === 'APPROVED' && template.approvedAt && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Approved
                </label>
                <p className="text-sm text-gray-600">
                  {new Date(template.approvedAt).toLocaleDateString('en-GB', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            )}

            {template.lastEditedAt && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last edited
                </label>
                <p className="text-sm text-gray-600">
                  {new Date(template.lastEditedAt).toLocaleDateString('en-GB', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            )}

            {template.approvalStatus !== 'APPROVED' && (
              <div>
                <form action={async () => {
                  startTransition(async () => {
                    const result = await approveWorkflowTemplate(surgeryId, templateId)
                    if (result.success) {
                      setSuccess('Workflow approved')
                      router.refresh()
                    } else {
                      setError(result.error || 'Failed to approve workflow')
                    }
                  })
                }}>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? 'Approving...' : 'Mark as Approved'}
                  </button>
                </form>
                <p className="text-xs text-gray-500 mt-2">
                  Approved workflows are visible to staff. Editing an approved workflow will revert it to Draft.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
