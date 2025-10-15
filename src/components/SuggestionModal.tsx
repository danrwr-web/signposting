'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'

interface SuggestionModalProps {
  isOpen: boolean
  onClose: () => void
  symptomId?: string
  symptomName?: string
  surgeryId?: string
}

export default function SuggestionModal({ 
  isOpen, 
  onClose, 
  symptomId, 
  symptomName, 
  surgeryId 
}: SuggestionModalProps) {
  const [userEmail, setUserEmail] = useState('')
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) {
      toast.error('Please enter your suggestion')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          surgeryId,
          baseId: symptomId,
          symptom: symptomName || '',
          userEmail: userEmail || undefined,
          text: text.trim(),
        }),
      })

      if (response.ok) {
        toast.success('Thank you for your suggestion!')
        setUserEmail('')
        setText('')
        onClose()
      } else {
        throw new Error('Failed to submit suggestion')
      }
    } catch (error) {
      toast.error('Failed to submit suggestion. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-semibold text-nhs-dark-blue mb-4">
          Suggest an Improvement
        </h2>
        
        {symptomName && (
          <p className="text-sm text-nhs-grey mb-4">
            For: <span className="font-medium">{symptomName}</span>
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-nhs-grey mb-1">
              Email (optional)
            </label>
            <input
              type="email"
              id="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="w-full px-3 py-2 border border-nhs-grey rounded-md focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
              placeholder="your.email@example.com"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="suggestion" className="block text-sm font-medium text-nhs-grey mb-1">
              Your suggestion *
            </label>
            <textarea
              id="suggestion"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-nhs-grey rounded-md focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
              placeholder="Please describe how we can improve this information..."
              required
            />
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-nhs-grey text-nhs-grey rounded-md hover:bg-nhs-light-grey transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-nhs-blue text-white rounded-md hover:bg-nhs-dark-blue transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
