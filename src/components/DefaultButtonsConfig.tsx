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
  session?: Session
}

export default function DefaultButtonsConfig({
  defaultButtons,
  enableDefaultHighRisk,
  onToggleAll,
  onToggleIndividual,
  onUpdateButton,
  session
}: DefaultButtonsConfigProps) {
  const [editingButton, setEditingButton] = useState<DefaultHighRiskButtonConfig | null>(null)

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

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg 
              className="h-5 w-5 text-blue-400" 
              viewBox="0 0 20 20" 
              fill="currentColor"
              aria-hidden="true"
            >
              <path 
                fillRule="evenodd" 
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" 
                clipRule="evenodd" 
              />
            </svg>
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-900">
              Default High-Risk Buttons
            </h4>
            <p className="text-xs text-blue-700">
              Configure which default buttons are enabled for this surgery
            </p>
          </div>
        </div>
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
                      aria-describedby={`edit-label-help-${button.buttonKey}`}
                    />
                    <p id={`edit-label-help-${button.buttonKey}`} className="text-xs text-gray-500 mt-1">
                      Display text for the button
                    </p>
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
                      aria-describedby={`edit-slug-help-${button.buttonKey}`}
                    />
                    <p id={`edit-slug-help-${button.buttonKey}`} className="text-xs text-gray-500 mt-1">
                      URL slug for the symptom page
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <ToggleSwitch
                    checked={editingButton.isEnabled}
                    onChange={(checked) => setEditingButton({ ...editingButton, isEnabled: checked })}
                    label="Enabled"
                    aria-describedby={`edit-status-help-${button.buttonKey}`}
                  />
                  <p id={`edit-status-help-${button.buttonKey}`} className="text-xs text-gray-500">
                    Whether this button is active
                  </p>
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
                <div className="flex items-center space-x-3">
                  <div className="text-sm font-medium text-gray-900">
                    {button.label}
                  </div>
                  <div className="text-xs text-gray-500">
                    Links to: {button.symptomSlug}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <ToggleSwitch
                    checked={button.isEnabled}
                    onChange={(checked) => onToggleIndividual(button.buttonKey, checked)}
                    label={`${button.label} button`}
                    aria-describedby={`button-status-${button.buttonKey}`}
                  />
                  <p id={`button-status-${button.buttonKey}`} className="text-xs text-gray-500">
                    {button.isEnabled ? 'Enabled' : 'Disabled'}
                  </p>
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
