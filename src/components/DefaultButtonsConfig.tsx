/**
 * Default buttons configuration component
 */

import { useState, useEffect, useRef } from 'react'
import { DefaultHighRiskButtonConfig } from '@/lib/api-contracts'
import { Session } from '@/server/auth'
import ToggleSwitch from './ToggleSwitch'

interface DefaultButtonsConfigProps {
  defaultButtons: DefaultHighRiskButtonConfig[]
  enableDefaultHighRisk: boolean
  onToggleAll: () => void
  onToggleIndividual: (buttonKey: string, isEnabled: boolean) => void
  onUpdateButton: (buttonKey: string, label: string, symptomSlug: string) => Promise<boolean>
  onAddButton?: (buttonKey: string, label: string, symptomSlug: string) => Promise<boolean>
  onDeleteButton?: (buttonKey: string) => Promise<boolean>
  symptoms?: Array<{ slug: string; name: string }>
  session?: Session
}

export default function DefaultButtonsConfig({
  defaultButtons,
  enableDefaultHighRisk,
  onToggleAll,
  onToggleIndividual,
  onUpdateButton,
  onAddButton,
  onDeleteButton,
  symptoms = [],
  session
}: DefaultButtonsConfigProps) {
  const [editingButton, setEditingButton] = useState<DefaultHighRiskButtonConfig | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newButton, setNewButton] = useState({ label: '', symptomSlug: '' })
  const [symptomSearch, setSymptomSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleUpdateButton = async () => {
    if (!editingButton) return
    
    const success = await onUpdateButton(
      editingButton.buttonKey, 
      editingButton.label, 
      editingButton.symptomSlug
    )
    
    if (success) {
      setEditingButton(null)
    }
  }

  const handleAddButton = async () => {
    if (!newButton.label || !newButton.symptomSlug) return
    if (!onAddButton) return
    
    // Auto-generate button key from label (e.g., "Heart Attack" -> "heart-attack")
    const buttonKey = newButton.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    
    const success = await onAddButton(buttonKey, newButton.label, newButton.symptomSlug)
    if (success) {
      setNewButton({ label: '', symptomSlug: '' })
      setShowAddForm(false)
    }
  }

  const handleDeleteButton = async (buttonKey: string) => {
    if (!onDeleteButton) return
    if (!confirm(`Are you sure you want to delete the "${defaultButtons.find(b => b.buttonKey === buttonKey)?.label}" button?`)) return
    
    await onDeleteButton(buttonKey)
  }

  // Filter symptoms based on search
  const filteredSymptoms = symptoms.filter(s => 
    s.name.toLowerCase().includes(symptomSearch.toLowerCase()) ||
    s.slug.toLowerCase().includes(symptomSearch.toLowerCase())
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSymptomSearch('')
      }
    }

    if (symptomSearch) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [symptomSearch])

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-medium text-blue-900">
            Default High-Risk Buttons
          </h4>
          <p className="text-xs text-blue-700">
            Configure which default buttons are enabled
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session?.type === 'superuser' && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1 bg-nhs-blue text-white rounded text-sm hover:bg-nhs-dark-blue transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
              aria-label="Add new default button"
            >
              Add Default Button
            </button>
          )}
          <button
            onClick={onToggleAll}
            className={`
              px-3 py-1 rounded text-sm transition-colors
              focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2
              ${enableDefaultHighRisk 
                ? 'bg-nhs-green text-white hover:bg-green-600' 
                : 'bg-gray-400 text-white hover:bg-gray-500'
              }
            `}
            aria-label={`${enableDefaultHighRisk ? 'Disable' : 'Enable'} all default buttons`}
          >
            {enableDefaultHighRisk ? 'Disable All' : 'Enable All'}
          </button>
        </div>
      </div>
      
      {showAddForm && session?.type === 'superuser' && (
        <div className="bg-white rounded p-4 mb-4 border border-blue-300">
          <h5 className="text-sm font-medium text-gray-900 mb-3">Add New Default Button</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="add-label">
                Button Label *
              </label>
              <input
                id="add-label"
                type="text"
                value={newButton.label}
                onChange={(e) => setNewButton({ ...newButton, label: e.target.value })}
                placeholder="e.g., Heart Attack"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-nhs-blue"
              />
              <p className="text-xs text-gray-500 mt-1">Button key will be auto-generated</p>
            </div>
            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="symptom-search">
                Link to Symptom *
              </label>
              <input
                id="symptom-search"
                type="text"
                value={symptomSearch}
                onChange={(e) => setSymptomSearch(e.target.value)}
                placeholder="Search symptoms..."
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-nhs-blue"
              />
              {symptomSearch && filteredSymptoms.length > 0 && (
                <div 
                  className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {filteredSymptoms.map((symptom) => (
                    <button
                      key={symptom.slug}
                      type="button"
                      onClick={() => {
                        setNewButton({ ...newButton, symptomSlug: symptom.slug })
                        setSymptomSearch('') // Clear search to hide dropdown
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                    >
                      <div className="font-medium">{symptom.name}</div>
                      <div className="text-xs text-gray-500">{symptom.slug}</div>
                    </button>
                  ))}
                </div>
              )}
              {newButton.symptomSlug && (
                <p className="text-xs text-green-600 mt-1">
                  Selected: {symptoms.find(s => s.slug === newButton.symptomSlug)?.name}
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={handleAddButton}
              disabled={!newButton.label || !newButton.symptomSlug}
              className="px-3 py-1 bg-nhs-green text-white text-xs rounded hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-green focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Button
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setNewButton({ label: '', symptomSlug: '' })
                setSymptomSearch('')
              }}
              className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      <div className="space-y-2">
        {defaultButtons.map((button) => (
          <div key={button.buttonKey} className="bg-white rounded p-3">
            {editingButton?.buttonKey === button.buttonKey ? (
              // Edit mode for superusers
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label 
                      className="block text-xs font-medium text-gray-700 mb-1"
                      htmlFor={`edit-label-${button.buttonKey}`}
                    >
                      Button Label
                    </label>
                    <input
                      id={`edit-label-${button.buttonKey}`}
                      type="text"
                      value={editingButton.label}
                      onChange={(e) => setEditingButton({ ...editingButton, label: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-nhs-blue"
                    />
                  </div>
                  <div>
                    <label 
                      className="block text-xs font-medium text-gray-700 mb-1"
                      htmlFor={`edit-slug-${button.buttonKey}`}
                    >
                      Symptom Slug
                    </label>
                    <input
                      id={`edit-slug-${button.buttonKey}`}
                      type="text"
                      value={editingButton.symptomSlug}
                      onChange={(e) => setEditingButton({ ...editingButton, symptomSlug: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-nhs-blue"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <ToggleSwitch
                    checked={editingButton.isEnabled}
                    onChange={(checked) => setEditingButton({ ...editingButton, isEnabled: checked })}
                    label="Enabled"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleUpdateButton}
                      className="px-3 py-1 bg-nhs-green text-white text-xs rounded hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-green focus:ring-offset-2"
                      aria-label="Save changes"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingButton(null)}
                      className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                      aria-label="Cancel editing"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // View mode
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900">
                  {button.label}
                </div>
                <div className="flex items-center space-x-2">
                  <ToggleSwitch
                    checked={button.isEnabled}
                    onChange={(checked) => onToggleIndividual(button.buttonKey, checked)}
                    label={`${button.label} button`}
                  />
                  {session?.type === 'superuser' && (
                    <>
                      <button
                        onClick={() => setEditingButton(button)}
                        className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        title="Edit button (Superuser only)"
                        aria-label={`Edit ${button.label} button`}
                      >
                        Edit
                      </button>
                      {onDeleteButton && (
                        <button
                          onClick={() => handleDeleteButton(button.buttonKey)}
                          className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                          title="Delete button (Superuser only)"
                          aria-label={`Delete ${button.label} button`}
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
