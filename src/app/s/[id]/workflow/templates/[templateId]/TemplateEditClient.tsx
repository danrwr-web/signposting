'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  updateWorkflowTemplate,
  createWorkflowNode,
  updateWorkflowNode,
  deleteWorkflowNode,
  createWorkflowAnswerOption,
  updateWorkflowAnswerOption,
  deleteWorkflowAnswerOption,
} from '../../actions'
import { WorkflowNodeType, WorkflowActionKey } from '@prisma/client'

interface WorkflowNode {
  id: string
  nodeType: WorkflowNodeType
  title: string
  body: string | null
  sortOrder: number
  isStart: boolean
  actionKey: WorkflowActionKey | null
  positionX: number | null
  positionY: number | null
  answerOptions: Array<{
    id: string
    label: string
    valueKey: string
    description: string | null
    nextNodeId: string | null
    actionKey: WorkflowActionKey | null
  }>
}

interface WorkflowTemplate {
  id: string
  name: string
  description: string | null
  colourHex: string | null
  isActive: boolean
  nodes: WorkflowNode[]
}

interface TemplateEditClientProps {
  surgeryId: string
  templateId: string
  surgeryName: string
  template: WorkflowTemplate
  updateTemplateAction: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  createNodeAction: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  updateNodeAction: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  deleteNodeAction: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  createAnswerOptionAction: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  updateAnswerOptionAction: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  deleteAnswerOptionAction: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  initialError?: string
  initialSuccess?: string
}

const NODE_TYPES: WorkflowNodeType[] = ['INSTRUCTION', 'QUESTION', 'END']
const ACTION_KEYS: WorkflowActionKey[] = [
  'FORWARD_TO_GP',
  'FORWARD_TO_PRESCRIBING_TEAM',
  'FORWARD_TO_PHARMACY_TEAM',
  'FILE_WITHOUT_FORWARDING',
  'ADD_TO_YELLOW_SLOT',
  'SEND_STANDARD_LETTER',
  'CODE_AND_FILE',
  'OTHER',
]

function formatActionKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export default function TemplateEditClient({
  surgeryId,
  templateId,
  surgeryName,
  template,
  updateTemplateAction,
  createNodeAction,
  updateNodeAction,
  deleteNodeAction,
  createAnswerOptionAction,
  updateAnswerOptionAction,
  deleteAnswerOptionAction,
  initialError,
  initialSuccess,
}: TemplateEditClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | undefined>(initialError)
  const [success, setSuccess] = useState<string | undefined>(initialSuccess)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null)
  const [showNewNodeForm, setShowNewNodeForm] = useState(false)
  const [showNewOptionForm, setShowNewOptionForm] = useState<string | null>(null)

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

  const handleNodeSubmit = async (nodeId: string | null, formData: FormData) => {
    setError(undefined)
    setSuccess(undefined)

    startTransition(async () => {
      // Add nodeId to formData if updating
      if (nodeId) {
        formData.set('nodeId', nodeId)
      }
      const result = nodeId
        ? await updateNodeAction(formData)
        : await createNodeAction(formData)

      if (result.success) {
        setSuccess(nodeId ? 'Node updated successfully' : 'Node created successfully')
        setEditingNodeId(null)
        setShowNewNodeForm(false)
        router.refresh()
      } else {
        setError(result.error || `Failed to ${nodeId ? 'update' : 'create'} node`)
      }
    })
  }

  const handleNodeDelete = async (nodeId: string) => {
    if (!confirm('Are you sure you want to delete this node? This will also delete all its answer options.')) {
      return
    }

    setError(undefined)
    setSuccess(undefined)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('nodeId', nodeId)
      const result = await deleteNodeAction(formData)
      if (result.success) {
        setSuccess('Node deleted successfully')
        router.refresh()
      } else {
        setError(result.error || 'Failed to delete node')
      }
    })
  }

  const handleAnswerOptionSubmit = async (nodeId: string, optionId: string | null, formData: FormData) => {
    setError(undefined)
    setSuccess(undefined)

    startTransition(async () => {
      // Add nodeId/optionId to formData
      formData.set('nodeId', nodeId)
      if (optionId) {
        formData.set('optionId', optionId)
      }
      const result = optionId
        ? await updateAnswerOptionAction(formData)
        : await createAnswerOptionAction(formData)

      if (result.success) {
        setSuccess(optionId ? 'Answer option updated successfully' : 'Answer option created successfully')
        setEditingOptionId(null)
        setShowNewOptionForm(null)
        router.refresh()
      } else {
        setError(result.error || `Failed to ${optionId ? 'update' : 'create'} answer option`)
      }
    })
  }

  const handleAnswerOptionDelete = async (optionId: string) => {
    if (!confirm('Are you sure you want to delete this answer option?')) {
      return
    }

    setError(undefined)
    setSuccess(undefined)

    startTransition(async () => {
      const formData = new FormData()
      formData.set('optionId', optionId)
      const result = await deleteAnswerOptionAction(formData)
      if (result.success) {
        setSuccess('Answer option deleted successfully')
        router.refresh()
      } else {
        setError(result.error || 'Failed to delete answer option')
      }
    })
  }

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
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              View Diagram
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            Edit Workflow Template: {template.name}
          </h1>
          <p className="text-gray-600">
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
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Template Details
          </h2>
          <form action={handleTemplateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <div>
                <label htmlFor="colourHex" className="block text-sm font-medium text-gray-700 mb-1">
                  Colour (hex)
                </label>
                <input
                  type="text"
                  id="colourHex"
                  name="colourHex"
                  defaultValue={template.colourHex || ''}
                  placeholder="#000000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
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
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isPending ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </form>
        </div>

        {/* Nodes Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">
              Workflow Nodes
            </h2>
            {!showNewNodeForm && (
              <button
                type="button"
                onClick={() => setShowNewNodeForm(true)}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Add Node
              </button>
            )}
          </div>

          {/* New Node Form */}
          {showNewNodeForm && (
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-md font-medium text-gray-900 mb-4">New Node</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleNodeSubmit(null, new FormData(e.currentTarget))
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="new-nodeType" className="block text-sm font-medium text-gray-700 mb-1">
                      Type *
                    </label>
                    <select
                      id="new-nodeType"
                      name="nodeType"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {NODE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="new-title" className="block text-sm font-medium text-gray-700 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      id="new-title"
                      name="title"
                      defaultValue="New node"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="new-body" className="block text-sm font-medium text-gray-700 mb-1">
                    Body
                  </label>
                  <textarea
                    id="new-body"
                    name="body"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="new-positionX" className="block text-sm font-medium text-gray-700 mb-1">
                      X Position (optional)
                    </label>
                    <input
                      type="number"
                      id="new-positionX"
                      name="positionX"
                      placeholder="Leave empty for auto layout"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="new-positionY" className="block text-sm font-medium text-gray-700 mb-1">
                      Y Position (optional)
                    </label>
                    <input
                      type="number"
                      id="new-positionY"
                      name="positionY"
                      placeholder="Leave empty for auto layout"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="new-isStart"
                      name="isStart"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="new-isStart" className="ml-2 block text-sm text-gray-900">
                      Start Node
                    </label>
                  </div>
                  <div className="flex-1">
                    <label htmlFor="new-actionKey" className="block text-sm font-medium text-gray-700 mb-1">
                      Action Key
                    </label>
                    <select
                      id="new-actionKey"
                      name="actionKey"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="NONE">None</option>
                      {ACTION_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {formatActionKey(key)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isPending ? 'Creating...' : 'Create Node'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewNodeForm(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Nodes Table */}
          {template.nodes.length === 0 ? (
            <div className="px-6 py-4 text-center text-sm text-gray-500">
              No nodes found. Click &quot;Add Node&quot; to create one.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {template.nodes.map((node) => {
                const isEditing = editingNodeId === node.id
                const isExpanded = expandedNodeId === node.id || isEditing
                const showAnswerOptions = node.nodeType === 'QUESTION' && isExpanded

                return (
                  <div key={node.id} className="px-6 py-4">
                    {isEditing ? (
                      // Edit Node Form
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          handleNodeSubmit(node.id, new FormData(e.currentTarget))
                        }}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label htmlFor={`node-${node.id}-sortOrder`} className="block text-sm font-medium text-gray-700 mb-1">
                              Sort Order
                            </label>
                            <input
                              type="number"
                              id={`node-${node.id}-sortOrder`}
                              name="sortOrder"
                              defaultValue={node.sortOrder}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label htmlFor={`node-${node.id}-nodeType`} className="block text-sm font-medium text-gray-700 mb-1">
                              Type *
                            </label>
                            <select
                              id={`node-${node.id}-nodeType`}
                              name="nodeType"
                              defaultValue={node.nodeType}
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {NODE_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label htmlFor={`node-${node.id}-positionX`} className="block text-sm font-medium text-gray-700 mb-1">
                              X Position (optional)
                            </label>
                            <input
                              type="number"
                              id={`node-${node.id}-positionX`}
                              name="positionX"
                              defaultValue={node.positionX ?? ''}
                              placeholder="Leave empty for auto layout"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label htmlFor={`node-${node.id}-positionY`} className="block text-sm font-medium text-gray-700 mb-1">
                              Y Position (optional)
                            </label>
                            <input
                              type="number"
                              id={`node-${node.id}-positionY`}
                              name="positionY"
                              defaultValue={node.positionY ?? ''}
                              placeholder="Leave empty for auto layout"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label htmlFor={`node-${node.id}-title`} className="block text-sm font-medium text-gray-700 mb-1">
                            Title *
                          </label>
                          <input
                            type="text"
                            id={`node-${node.id}-title`}
                            name="title"
                            defaultValue={node.title}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label htmlFor={`node-${node.id}-body`} className="block text-sm font-medium text-gray-700 mb-1">
                            Body
                          </label>
                          <textarea
                            id={`node-${node.id}-body`}
                            name="body"
                            defaultValue={node.body || ''}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id={`node-${node.id}-isStart`}
                              name="isStart"
                              defaultChecked={node.isStart}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor={`node-${node.id}-isStart`} className="ml-2 block text-sm text-gray-900">
                              Start Node
                            </label>
                          </div>
                          <div className="flex-1">
                            <label htmlFor={`node-${node.id}-actionKey`} className="block text-sm font-medium text-gray-700 mb-1">
                              Action Key
                            </label>
                            <select
                              id={`node-${node.id}-actionKey`}
                              name="actionKey"
                              defaultValue={node.actionKey || 'NONE'}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="NONE">None</option>
                              {ACTION_KEYS.map((key) => (
                                <option key={key} value={key}>
                                  {formatActionKey(key)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label htmlFor={`node-${node.id}-positionX`} className="block text-sm font-medium text-gray-700 mb-1">
                              X Position (optional)
                            </label>
                            <input
                              type="number"
                              id={`node-${node.id}-positionX`}
                              name="positionX"
                              defaultValue={node.positionX ?? ''}
                              placeholder="Auto"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label htmlFor={`node-${node.id}-positionY`} className="block text-sm font-medium text-gray-700 mb-1">
                              Y Position (optional)
                            </label>
                            <input
                              type="number"
                              id={`node-${node.id}-positionY`}
                              name="positionY"
                              defaultValue={node.positionY ?? ''}
                              placeholder="Auto"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            type="submit"
                            disabled={isPending}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                          >
                            {isPending ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingNodeId(null)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNodeDelete(node.id)}
                            disabled={isPending}
                            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </form>
                    ) : (
                      // Node Display
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 grid grid-cols-6 gap-4 items-center">
                            <div className="text-sm text-gray-900 font-medium">{node.sortOrder}</div>
                            <div className="text-sm text-gray-900">{node.nodeType}</div>
                            <div className="text-sm font-medium text-gray-900">{node.title}</div>
                            <div className="text-sm text-gray-500 truncate">
                              {node.body ? (node.body.substring(0, 50) + (node.body.length > 50 ? '...' : '')) : '—'}
                            </div>
                            <div>
                              {node.isStart && (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                  Start
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {node.actionKey ? formatActionKey(node.actionKey) : '—'}
                            </div>
                          </div>
                          <div className="flex space-x-2 ml-4">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNodeId(node.id)
                                setExpandedNodeId(node.id)
                              }}
                              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedNodeId(isExpanded ? null : node.id)}
                              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                            >
                              {isExpanded ? 'Collapse' : 'Expand'}
                            </button>
                          </div>
                        </div>

                        {/* Answer Options for QUESTION nodes */}
                        {showAnswerOptions && (
                          <div className="mt-4 ml-8 pl-4 border-l-2 border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="text-sm font-medium text-gray-900">Answer Options</h4>
                              {!showNewOptionForm && (
                                <button
                                  type="button"
                                  onClick={() => setShowNewOptionForm(node.id)}
                                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                  Add Option
                                </button>
                              )}
                            </div>

                            {/* New Answer Option Form */}
                            {showNewOptionForm === node.id && (
                              <div className="mb-4 p-3 bg-gray-50 rounded">
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault()
                                    handleAnswerOptionSubmit(node.id, null, new FormData(e.currentTarget))
                                  }}
                                  className="space-y-3"
                                >
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div>
                                      <label htmlFor={`new-option-${node.id}-label`} className="block text-xs font-medium text-gray-700 mb-1">
                                        Label *
                                      </label>
                                      <input
                                        type="text"
                                        id={`new-option-${node.id}-label`}
                                        name="label"
                                        required
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div>
                                      <label htmlFor={`new-option-${node.id}-valueKey`} className="block text-xs font-medium text-gray-700 mb-1">
                                        Value Key *
                                      </label>
                                      <input
                                        type="text"
                                        id={`new-option-${node.id}-valueKey`}
                                        name="valueKey"
                                        required
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label htmlFor={`new-option-${node.id}-description`} className="block text-xs font-medium text-gray-700 mb-1">
                                      Description
                                    </label>
                                    <textarea
                                      id={`new-option-${node.id}-description`}
                                      name="description"
                                      rows={2}
                                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div>
                                      <label htmlFor={`new-option-${node.id}-nextNodeId`} className="block text-xs font-medium text-gray-700 mb-1">
                                        Next Node
                                      </label>
                                      <select
                                        id={`new-option-${node.id}-nextNodeId`}
                                        name="nextNodeId"
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="NONE">None</option>
                                        {template.nodes
                                          .filter((n) => n.id !== node.id)
                                          .map((n) => (
                                            <option key={n.id} value={n.id}>
                                              {n.sortOrder}: {n.title}
                                            </option>
                                          ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label htmlFor={`new-option-${node.id}-actionKey`} className="block text-xs font-medium text-gray-700 mb-1">
                                        Action Key
                                      </label>
                                      <select
                                        id={`new-option-${node.id}-actionKey`}
                                        name="actionKey"
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="NONE">None</option>
                                        {ACTION_KEYS.map((key) => (
                                          <option key={key} value={key}>
                                            {formatActionKey(key)}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                  <div className="flex space-x-2">
                                    <button
                                      type="submit"
                                      disabled={isPending}
                                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      Create
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setShowNewOptionForm(null)}
                                      className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              </div>
                            )}

                            {/* Answer Options List */}
                            {node.answerOptions.length === 0 ? (
                              <p className="text-sm text-gray-500">No answer options. Click &quot;Add Option&quot; to create one.</p>
                            ) : (
                              <div className="space-y-2">
                                {node.answerOptions.map((option) => {
                                  const isEditingOption = editingOptionId === option.id

                                  return (
                                    <div key={option.id} className="p-2 bg-gray-50 rounded">
                                      {isEditingOption ? (
                                        <form
                                          onSubmit={(e) => {
                                            e.preventDefault()
                                            handleAnswerOptionSubmit(node.id, option.id, new FormData(e.currentTarget))
                                          }}
                                          className="space-y-2"
                                        >
                                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            <div>
                                              <label htmlFor={`option-${option.id}-label`} className="block text-xs font-medium text-gray-700 mb-1">
                                                Label *
                                              </label>
                                              <input
                                                type="text"
                                                id={`option-${option.id}-label`}
                                                name="label"
                                                defaultValue={option.label}
                                                required
                                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                              />
                                            </div>
                                            <div>
                                              <label htmlFor={`option-${option.id}-valueKey`} className="block text-xs font-medium text-gray-700 mb-1">
                                                Value Key *
                                              </label>
                                              <input
                                                type="text"
                                                id={`option-${option.id}-valueKey`}
                                                name="valueKey"
                                                defaultValue={option.valueKey}
                                                required
                                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                              />
                                            </div>
                                          </div>
                                          <div>
                                            <label htmlFor={`option-${option.id}-description`} className="block text-xs font-medium text-gray-700 mb-1">
                                              Description
                                            </label>
                                            <textarea
                                              id={`option-${option.id}-description`}
                                              name="description"
                                              defaultValue={option.description || ''}
                                              rows={2}
                                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                          </div>
                                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            <div>
                                              <label htmlFor={`option-${option.id}-nextNodeId`} className="block text-xs font-medium text-gray-700 mb-1">
                                                Next Node
                                              </label>
                                              <select
                                                id={`option-${option.id}-nextNodeId`}
                                                name="nextNodeId"
                                                defaultValue={option.nextNodeId || 'NONE'}
                                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                              >
                                                <option value="NONE">None</option>
                                                {template.nodes
                                                  .filter((n) => n.id !== node.id)
                                                  .map((n) => (
                                                    <option key={n.id} value={n.id}>
                                                      {n.sortOrder}: {n.title}
                                                    </option>
                                                  ))}
                                              </select>
                                            </div>
                                            <div>
                                              <label htmlFor={`option-${option.id}-actionKey`} className="block text-xs font-medium text-gray-700 mb-1">
                                                Action Key
                                              </label>
                                              <select
                                                id={`option-${option.id}-actionKey`}
                                                name="actionKey"
                                                defaultValue={option.actionKey || 'NONE'}
                                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                              >
                                                <option value="NONE">None</option>
                                                {ACTION_KEYS.map((key) => (
                                                  <option key={key} value={key}>
                                                    {formatActionKey(key)}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                          </div>
                                          <div className="flex space-x-2">
                                            <button
                                              type="submit"
                                              disabled={isPending}
                                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                            >
                                              Save
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEditingOptionId(null)}
                                              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleAnswerOptionDelete(option.id)}
                                              disabled={isPending}
                                              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        </form>
                                      ) : (
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1 grid grid-cols-4 gap-2 text-sm">
                                            <div className="font-medium text-gray-900">{option.label}</div>
                                            <div className="text-gray-600">{option.valueKey}</div>
                                            <div className="text-gray-500">{option.description || '—'}</div>
                                            <div className="text-gray-500">
                                              {option.nextNodeId
                                                ? `→ ${template.nodes.find((n) => n.id === option.nextNodeId)?.title || option.nextNodeId}`
                                                : option.actionKey
                                                ? formatActionKey(option.actionKey)
                                                : '—'}
                                            </div>
                                          </div>
                                          <div className="flex space-x-2 ml-4">
                                            <button
                                              type="button"
                                              onClick={() => setEditingOptionId(option.id)}
                                              className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
                                            >
                                              Edit
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleAnswerOptionDelete(option.id)}
                                              disabled={isPending}
                                              className="px-2 py-1 text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

