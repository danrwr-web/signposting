'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  WorkflowInstance, 
  WorkflowNodeTemplate, 
  WorkflowAnswerOptionTemplate,
  WorkflowActionKey,
  WorkflowNodeType 
} from '@prisma/client'
import { ActionResult } from '../../actions'

interface ExtendedInstance extends WorkflowInstance {
  template: {
    id: string
    name: string
    description: string | null
  }
  startedBy: {
    id: string
    name: string | null
    email: string
  }
  answers: Array<{
    id: string
    answerOption: {
      id: string
      label: string
      valueKey: string
    } | null
    answerValueKey: string | null
    freeTextNote: string | null
    nodeTemplate: {
      id: string
      title: string
    }
    createdAt: Date
  }>
}

interface ExtendedNode extends WorkflowNodeTemplate {
  answerOptions: WorkflowAnswerOptionTemplate[]
}

interface WorkflowRunnerClientProps {
  surgeryId: string
  surgeryName: string
  instance: ExtendedInstance
  currentNode: ExtendedNode | null
  continueAction: (formData: FormData) => Promise<ActionResult & { nextNodeId?: string }>
  answerAction: (formData: FormData) => Promise<ActionResult & { completed?: boolean; actionKey?: string }>
  completed: boolean
  finalActionKey: string | null
}

function formatActionKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export default function WorkflowRunnerClient({
  surgeryId,
  surgeryName,
  instance,
  currentNode,
  continueAction,
  answerAction,
  completed,
  finalActionKey,
}: WorkflowRunnerClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | undefined>()
  const [freeTextNote, setFreeTextNote] = useState<string>('')

  const handleContinue = () => {
    setError(undefined)
    const formData = new FormData()
    startTransition(async () => {
      const result = await continueAction(formData)
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error || 'Failed to continue workflow')
      }
    })
  }

  const handleAnswer = (answerOptionId: string) => {
    setError(undefined)
    const formData = new FormData()
    formData.set('answerOptionId', answerOptionId)
    if (freeTextNote) {
      formData.set('freeTextNote', freeTextNote)
    }
    startTransition(async () => {
      const result = await answerAction(formData)
      if (result.success) {
        if (result.completed) {
          router.refresh()
        } else {
          router.refresh()
        }
      } else {
        setError(result.error || 'Failed to record answer')
      }
    })
  }

  // Completion summary
  if (completed) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <Link
              href={`/s/${surgeryId}/workflow`}
              className="text-blue-600 hover:text-blue-800 underline mb-2 inline-block"
            >
              ← Back to Workflow Guidance
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">
              Workflow Completed
            </h1>
            <p className="text-gray-600">
              {surgeryName}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {instance.template.name}
              </h2>
              {instance.reference && (
                <p className="text-sm text-gray-600">
                  <strong>Reference:</strong> {instance.reference}
                </p>
              )}
              {instance.category && (
                <p className="text-sm text-gray-600">
                  <strong>Category:</strong> {instance.category}
                </p>
              )}
            </div>

            {finalActionKey && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
                  Final Action
                </h3>
                <p className="text-lg font-semibold text-blue-900">
                  {formatActionKey(finalActionKey)}
                </p>
              </div>
            )}

            {!finalActionKey && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-900">
                  Workflow completed successfully.
                </p>
              </div>
            )}

            <div>
              <Link
                href={`/s/${surgeryId}/workflow`}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Back to Workflow Guidance
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentNode) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">No current node found.</p>
            <Link
              href={`/s/${surgeryId}/workflow`}
              className="text-blue-600 hover:text-blue-800 underline mt-4 inline-block"
            >
              Back to Workflow Guidance
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href={`/s/${surgeryId}/workflow`}
            className="text-blue-600 hover:text-blue-800 underline mb-2 inline-block"
          >
            ← Back to Workflow Guidance
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {instance.template.name}
          </h1>
          <p className="text-gray-600">
            {surgeryName}
            {instance.reference && ` • ${instance.reference}`}
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Error:</strong>
            <span className="block sm:inline"> {error}</span>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Node Content */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              {currentNode.title}
            </h2>
            {currentNode.body && (
              <div className="text-gray-700 whitespace-pre-wrap mb-4">
                {currentNode.body}
              </div>
            )}
          </div>

          {/* INSTRUCTION Node */}
          {currentNode.nodeType === 'INSTRUCTION' && (
            <div>
              <button
                onClick={handleContinue}
                disabled={isPending}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? 'Loading...' : 'Continue'}
              </button>
            </div>
          )}

          {/* QUESTION Node */}
          {currentNode.nodeType === 'QUESTION' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="freeTextNote" className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (optional)
                </label>
                <textarea
                  id="freeTextNote"
                  value={freeTextNote}
                  onChange={(e) => setFreeTextNote(e.target.value)}
                  rows={3}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Add any additional notes or comments..."
                />
              </div>
              <div className="space-y-2">
                {currentNode.answerOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleAnswer(option.id)}
                    disabled={isPending}
                    className="w-full text-left py-3 px-4 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <div className="font-medium text-gray-900">{option.label}</div>
                    {option.description && (
                      <div className="text-sm text-gray-600 mt-1">{option.description}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* END Node */}
          {currentNode.nodeType === 'END' && (
            <div>
              {currentNode.actionKey && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-medium text-blue-900 mb-2">
                    Final Action
                  </h3>
                  <p className="text-lg font-semibold text-blue-900">
                    {formatActionKey(currentNode.actionKey)}
                  </p>
                </div>
              )}
              <Link
                href={`/s/${surgeryId}/workflow`}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Back to Workflow Guidance
              </Link>
            </div>
          )}
        </div>

        {/* Answer History */}
        {instance.answers.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Answer History
            </h3>
            <div className="space-y-3">
              {instance.answers.map((answer) => (
                <div key={answer.id} className="border-b border-gray-200 pb-3 last:border-0 last:pb-0">
                  <div className="text-sm font-medium text-gray-900">
                    {answer.nodeTemplate.title}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {answer.answerOption?.label || answer.answerValueKey || '—'}
                  </div>
                  {answer.freeTextNote && (
                    <div className="text-xs text-gray-500 mt-1 italic">
                      Note: {answer.freeTextNote}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

