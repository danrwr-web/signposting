/**
 * High risk buttons list component
 */

import { useState } from 'react'
import { HighRiskLink } from '@/lib/api-contracts'

interface HighRiskButtonsListProps {
  highRiskLinks: HighRiskLink[]
  onDeleteLink: (id: string) => Promise<boolean>
  onUpdateOrder: (id: string, newOrder: number) => Promise<boolean>
}

export default function HighRiskButtonsList({ 
  highRiskLinks, 
  onDeleteLink, 
  onUpdateOrder 
}: HighRiskButtonsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this high-risk button?')) {
      return
    }

    setDeletingId(id)
    await onDeleteLink(id)
    setDeletingId(null)
  }

  const handleMoveUp = async (link: HighRiskLink) => {
    await onUpdateOrder(link.id, link.orderIndex - 1)
  }

  const handleMoveDown = async (link: HighRiskLink) => {
    await onUpdateOrder(link.id, link.orderIndex + 1)
  }

  // Filter out default buttons since they're managed in DefaultButtonsConfig
  const customButtons = (Array.isArray(highRiskLinks) ? highRiskLinks : [])
    .filter(link => !link.id.startsWith('default-'))
    .sort((a, b) => a.orderIndex - b.orderIndex)

  if (customButtons.length === 0) {
    return (
      <div className="text-center py-8 text-nhs-grey">
        <svg 
          className="mx-auto h-12 w-12 text-gray-400 mb-4" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
          aria-hidden="true"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 6v6m0 0v6m0-6h6m-6 0H6" 
          />
        </svg>
        <p className="text-lg font-medium text-nhs-dark-blue mb-2">
          No custom buttons configured
        </p>
        <p className="text-sm text-nhs-grey">
          Click "Add Custom Button" to create your first custom high-risk button.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-md font-medium text-nhs-dark-blue mb-3">
        Custom High-Risk Buttons
      </h3>
      {customButtons.map((link) => (
        <div 
          key={link.id} 
          className="flex items-center justify-between rounded-lg p-4 bg-nhs-light-grey"
        >
          <div className="text-sm font-medium text-nhs-dark-blue">
            {link.label}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleMoveUp(link)}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              title="Move up"
              aria-label={`Move ${link.label} button up`}
            >
              ↑
            </button>
            <button
              onClick={() => handleMoveDown(link)}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              title="Move down"
              aria-label={`Move ${link.label} button down`}
            >
              ↓
            </button>
            <button
              onClick={() => handleDelete(link.id)}
              disabled={deletingId === link.id}
              className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Delete ${link.label} button`}
            >
              {deletingId === link.id ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
