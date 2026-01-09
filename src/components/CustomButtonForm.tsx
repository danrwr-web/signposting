/**
 * Custom button form component
 */

import { useEffect, useMemo, useRef, useState } from 'react'

interface CustomButtonFormProps {
  onSubmit: (data: { label?: string; symptomId: string; symptomSlug?: string; orderIndex: number }) => Promise<boolean>
  onCancel: () => void
  symptoms: Array<{ id: string; slug: string; name: string }>
}

export default function CustomButtonForm({ onSubmit, onCancel, symptoms }: CustomButtonFormProps) {
  const [formData, setFormData] = useState({
    label: '',
    symptomId: '',
    symptomSlug: '',
    symptomName: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [symptomSearch, setSymptomSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const listboxId = 'custom-symptom-listbox'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!formData.symptomId) {
      setError('Please select a symptom.')
      return
    }

    setIsSubmitting(true)
    const labelToSave = formData.label.trim() || formData.symptomName
    const success = await onSubmit({
      label: labelToSave,
      symptomId: formData.symptomId,
      symptomSlug: formData.symptomSlug,
      orderIndex: 0,
    })
    setIsSubmitting(false)

    if (success) {
      setFormData({ label: '', symptomId: '', symptomSlug: '', symptomName: '' })
      setSymptomSearch('')
    }
  }

  const sortedSymptoms = useMemo(() => {
    return [...(symptoms || [])].sort((a, b) => a.name.localeCompare(b.name))
  }, [symptoms])

  const filteredSymptoms = useMemo(() => {
    const q = symptomSearch.trim().toLowerCase()
    if (!q) return []
    return sortedSymptoms.filter(s => s.name.toLowerCase().includes(q))
  }, [sortedSymptoms, symptomSearch])

  // Close dropdown when clicking outside
  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSymptomSearch('')
      }
    }
    if (symptomSearch) {
      document.addEventListener('mousedown', onDocMouseDown)
    }
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [symptomSearch])

  return (
    <div className="bg-nhs-light-grey rounded-lg p-4 mb-6">
      <h4 className="text-md font-medium text-nhs-dark-blue mb-3">
        Add New High-Risk Button
      </h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label 
              className="block text-sm font-medium text-nhs-grey mb-1"
              htmlFor="custom-label"
            >
              Button label (optional)
            </label>
            <input
              id="custom-label"
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder={formData.symptomName ? `Defaults to: ${formData.symptomName}` : 'Leave blank to use the symptom name'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              aria-describedby="custom-label-help"
            />
            <p id="custom-label-help" className="text-xs text-gray-500 mt-1">
              If left blank, the symptom name will be used.
            </p>
          </div>
          <div className="relative" ref={dropdownRef}>
            <label 
              className="block text-sm font-medium text-nhs-grey mb-1"
              htmlFor="custom-symptom"
            >
              Symptom *
            </label>
            <input
              id="custom-symptom"
              type="text"
              value={symptomSearch}
              onChange={(e) => {
                setSymptomSearch(e.target.value)
                setError(null)
              }}
              placeholder="Search symptoms…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              aria-describedby="custom-symptom-help"
              role="combobox"
              aria-expanded={!!symptomSearch && filteredSymptoms.length > 0}
              aria-controls={listboxId}
            />
            {symptomSearch && filteredSymptoms.length > 0 && (
              <div
                id={listboxId}
                className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                role="listbox"
                aria-label="Matching symptoms"
              >
                {filteredSymptoms.map((symptom) => (
                  <button
                    key={symptom.id}
                    type="button"
                    onClick={() => {
                      setFormData((prev) => {
                        const next = {
                          ...prev,
                          symptomId: symptom.id,
                          symptomSlug: symptom.slug,
                          symptomName: symptom.name,
                        }
                        // Default label to symptom name if empty.
                        if (!prev.label.trim()) {
                          next.label = symptom.name
                        }
                        return next
                      })
                      setSymptomSearch('')
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                    role="option"
                    aria-selected={formData.symptomId === symptom.id}
                  >
                    <div className="font-medium">{symptom.name}</div>
                  </button>
                ))}
              </div>
            )}
            {formData.symptomName ? (
              <p id="custom-symptom-help" className="text-xs text-gray-500 mt-1">
                Selected: <span className="font-medium text-gray-700">{formData.symptomName}</span>
              </p>
            ) : (
              <p id="custom-symptom-help" className="text-xs text-gray-500 mt-1">
                Select a symptom to link the button.
              </p>
            )}
          </div>
        </div>
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2" role="alert">
            {error}
          </div>
        )}
        <div className="flex items-end space-x-2">
          <button
            type="submit"
            disabled={isSubmitting || !formData.symptomId}
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
