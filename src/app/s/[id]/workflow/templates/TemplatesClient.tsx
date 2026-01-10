'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import CreateWorkflowModal from '@/components/workflow/CreateWorkflowModal'

interface Template {
  id: string
  name: string
  description: string | null
  isActive: boolean
  workflowType: string | null
  createdAt: Date
  approvalStatus?: string
  source?: 'global' | 'override' | 'custom'
  sourceTemplateId?: string | null
}

interface TemplatesClientProps {
  surgeryId: string
  templates: Template[]
  isSuperuser: boolean
}

const GLOBAL_SURGERY_ID = 'global-default-buttons'

export default function TemplatesClient({ surgeryId, templates, isSuperuser }: TemplatesClientProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const getWorkflowTypeBadge = (type: string | null) => {
    if (!type) return null
    
    const badges = {
      PRIMARY: { label: 'Primary', className: 'bg-blue-100 text-blue-800' },
      SUPPORTING: { label: 'Supporting', className: 'bg-gray-100 text-gray-800' },
      MODULE: { label: 'Module', className: 'bg-purple-100 text-purple-800' },
    }
    
    const badge = badges[type as keyof typeof badges]
    if (!badge) return null
    
    return (
      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${badge.className}`}>
        {badge.label}
      </span>
    )
  }

  const handleDeleteClick = (templateId: string, templateName: string) => {
    setDeletingId(templateId)
    setDeleteConfirm('')
  }

  const handleDeleteCancel = () => {
    setDeletingId(null)
    setDeleteConfirm('')
  }

  const handleDeleteConfirm = async (templateId: string) => {
    if (deleteConfirm !== 'DELETE' || isDeleting) {
      return
    }

    setIsDeleting(true)
    
    try {
      const response = await fetch(`/api/workflow/delete?SurgeryId=${surgeryId}&TemplateId=${templateId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete workflow')
      }

      // Reset state and refresh the page to show updated list
      setDeletingId(null)
      setDeleteConfirm('')
      setIsDeleting(false)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete workflow')
      setDeletingId(null)
      setDeleteConfirm('')
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <Link
            href={`/s/${surgeryId}/workflow`}
            className="text-blue-600 hover:text-blue-800 underline mb-2 inline-block"
          >
            ← Back to Workflow Guidance
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            Manage Workflow Templates
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Create workflow…
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {templates.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  No workflow templates found
                </td>
              </tr>
            ) : (
              templates.map((template) => (
                <tr key={template.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <span>{template.name}</span>
                      {template.approvalStatus === 'DRAFT' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Draft (not visible to staff)
                        </span>
                      )}
                      {template.source === 'global' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          Global
                        </span>
                      )}
                      {template.source === 'override' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                          Customised
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {template.description || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getWorkflowTypeBadge(template.workflowType)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      template.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {template.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(template.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                    {(() => {
                      const editSurgeryId =
                        isSuperuser && template.source === 'global' ? GLOBAL_SURGERY_ID : surgeryId
                      return (
                        <>
                    <Link
                      href={`/s/${surgeryId}/workflow/templates/${template.id}/view`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Open diagram
                    </Link>
                    <span className="text-gray-300">|</span>
                    <Link
                      href={`/s/${editSurgeryId}/workflow/templates/${template.id}`}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      Edit
                    </Link>
                    <span className="text-gray-300">|</span>
                        </>
                      )
                    })()}
                    {deletingId === template.id ? (
                      <span className="inline-flex items-center gap-2">
                        <input
                          type="text"
                          value={deleteConfirm}
                          onChange={(e) => setDeleteConfirm(e.target.value)}
                          placeholder="Type DELETE"
                          className="w-28 px-2 py-1 text-xs border border-red-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && deleteConfirm === 'DELETE') {
                              handleDeleteConfirm(template.id)
                            } else if (e.key === 'Escape') {
                              handleDeleteCancel()
                            }
                          }}
                        />
                        <button
                          onClick={() => handleDeleteConfirm(template.id)}
                          disabled={deleteConfirm !== 'DELETE' || isDeleting}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                        >
                          {isDeleting ? 'Deleting...' : 'Confirm'}
                        </button>
                        <button
                          onClick={handleDeleteCancel}
                          disabled={isDeleting}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDeleteClick(template.id, template.name)}
                        className="text-red-600 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 rounded"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CreateWorkflowModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        surgeryId={surgeryId}
      />
    </>
  )
}

