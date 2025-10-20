/**
 * Custom button form component
 */

import { useState } from 'react'

interface CustomButtonFormProps {
  onSubmit: (data: { label: string; symptomSlug: string; orderIndex: number }) => Promise<boolean>
  onCancel: () => void
}

export default function CustomButtonForm({ onSubmit, onCancel }: CustomButtonFormProps) {
  const [formData, setFormData] = useState({
    label: '',
    symptomSlug: '',
    orderIndex: 0
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.label.trim()) return

    setIsSubmitting(true)
    const success = await onSubmit(formData)
    setIsSubmitting(false)

    if (success) {
      setFormData({ label: '', symptomSlug: '', orderIndex: 0 })
    }
  }

  return (
    <div className="bg-nhs-light-grey rounded-lg p-4 mb-6">
      <h4 className="text-md font-medium text-nhs-dark-blue mb-3">
        Add New High-Risk Button
      </h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label 
              className="block text-sm font-medium text-nhs-grey mb-1"
              htmlFor="custom-label"
            >
              Button Label *
            </label>
            <input
              id="custom-label"
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="e.g., Anaphylaxis, Stroke"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              required
              aria-describedby="custom-label-help"
            />
            <p id="custom-label-help" className="text-xs text-gray-500 mt-1">
              Display text for the button
            </p>
          </div>
          <div>
            <label 
              className="block text-sm font-medium text-nhs-grey mb-1"
              htmlFor="custom-slug"
            >
              Symptom Slug
            </label>
            <input
              id="custom-slug"
              type="text"
              value={formData.symptomSlug}
              onChange={(e) => setFormData({ ...formData, symptomSlug: e.target.value })}
              placeholder="e.g., anaphylaxis, stroke"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              aria-describedby="custom-slug-help"
            />
            <p id="custom-slug-help" className="text-xs text-gray-500 mt-1">
              URL slug for the symptom page (optional)
            </p>
          </div>
          <div>
            <label 
              className="block text-sm font-medium text-nhs-grey mb-1"
              htmlFor="custom-order"
            >
              Order Index
            </label>
            <input
              id="custom-order"
              type="number"
              value={formData.orderIndex}
              onChange={(e) => setFormData({ ...formData, orderIndex: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              aria-describedby="custom-order-help"
            />
            <p id="custom-order-help" className="text-xs text-gray-500 mt-1">
              Lower numbers appear first
            </p>
          </div>
        </div>
        <div className="flex items-end space-x-2">
          <button
            type="submit"
            disabled={isSubmitting || !formData.label.trim()}
            className="px-4 py-2 bg-nhs-green text-white rounded-lg hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-green focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Add custom high-risk button"
          >
            {isSubmitting ? 'Adding...' : 'Add Button'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            aria-label="Cancel adding custom button"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
