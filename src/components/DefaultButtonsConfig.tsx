/**
 * Default buttons configuration component
 */

import { useState } from 'react'
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
  session?: Session
}

export default function DefaultButtonsConfig({
  defaultButtons,
  enableDefaultHighRisk,
  onToggleAll,
  onToggleIndividual,
  onUpdateButton,
  onAddButton,
  session
}: DefaultButtonsConfigProps) {
  const [editingButton, setEditingButton] = useState<DefaultHighRiskButtonConfig | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newButton, setNewButton] = useState({ buttonKey: '', label: '', symptomSlug: '' })

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
    if (!newButton.buttonKey || !newButton.label || !newButton.symptomSlug) return
    if (!onAddButton) return
    
    const success = await onAddButton(newButton.buttonKey, newButton.label, newButton.symptomSlug)
    if (success) {
      setNewButton({ buttonKey: '', label: '', symptomSlug: '' })
      setShowAddForm(false)
    }
  }

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="add-key">
                Button Key *
              </label>
              <input
                id="add-key"
                type="text"
                value={newButton.buttonKey}
                onChange={(e) => setNewButton({ ...newButton, buttonKey: e.target.value })}
                placeholder="e.g., heart-attack"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-nhs-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="add-label">
                Label *
              </label>
              <input
                id="add-label"
                type="text"
                value={newButton.label}
                onChange={(e) => setNewButton({ ...newButton, label: e.target.value })}
                placeholder="e.g., Heart Attack"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-nhs-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="add-slug">
                Symptom Slug *
              </label>
              <input
                id="add-slug"
                type="text"
                value={newButton.symptomSlug}
                onChange={(e) => setNewButton({ ...newButton, symptomSlug: e.target.value })}
                placeholder="e.g., heart-attack"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-nhs-blue"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={handleAddButton}
              disabled={!newButton.buttonKey || !newButton.label || !newButton.symptomSlug}
              className="px-3 py-1 bg-nhs-green text-white text-xs rounded hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-green focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Button
            </button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setNewButton({ buttonKey: '', label: '', symptomSlug: '' })
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
                    <button
                      onClick={() => setEditingButton(button)}
                      className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      title="Edit button (Superuser only)"
                      aria-label={`Edit ${button.label} button`}
                    >
                      Edit
                    </button>
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
