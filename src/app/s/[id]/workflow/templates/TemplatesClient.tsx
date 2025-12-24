'use client'

import { useState } from 'react'
import Link from 'next/link'
import CreateWorkflowModal from '@/components/workflow/CreateWorkflowModal'

interface Template {
  id: string
  name: string
  description: string | null
  isActive: boolean
  workflowType: string | null
  createdAt: Date
}

interface TemplatesClientProps {
  surgeryId: string
  templates: Template[]
}

export default function TemplatesClient({ surgeryId, templates }: TemplatesClientProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)

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
                    {template.name}
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
                    <Link
                      href={`/s/${surgeryId}/workflow/templates/${template.id}/view`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Open diagram
                    </Link>
                    <span className="text-gray-300">|</span>
                    <Link
                      href={`/s/${surgeryId}/workflow/templates/${template.id}`}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      Edit
                    </Link>
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

