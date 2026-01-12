/**
 * Common Reasons for Calling configuration component
 * Allows surgery admins to configure the common reasons row on the landing page
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import { CommonReasonsConfig, UiConfig } from '@/lib/commonReasons'
import { useEffect } from 'react'

interface CommonReasonsConfigProps {
  surgeryId?: string
  symptoms: EffectiveSymptom[]
  initialConfig?: CommonReasonsConfig | null
}

export default function CommonReasonsConfig({ surgeryId, symptoms, initialConfig }: CommonReasonsConfigProps) {
  const [enabled, setEnabled] = useState(initialConfig?.commonReasonsEnabled ?? false)
  const [selectedIds, setSelectedIds] = useState<string[]>(initialConfig?.commonReasonsSymptomIds ?? [])
  const [maxChips, setMaxChips] = useState(initialConfig?.commonReasonsMax ?? 8)
  const [searchTerm, setSearchTerm] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(!initialConfig && !!surgeryId)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Fetch initial config if not provided
  useEffect(() => {
    if (!initialConfig && surgeryId && isLoading) {
      fetch(`/api/admin/surgery-settings?surgeryId=${surgeryId}`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            const uiConfig = data.surgery?.uiConfig as UiConfig | null
            if (uiConfig?.commonReasons) {
              setEnabled(uiConfig.commonReasons.commonReasonsEnabled)
              setSelectedIds(uiConfig.commonReasons.commonReasonsSymptomIds)
              setMaxChips(uiConfig.commonReasons.commonReasonsMax)
            }
          }
        })
        .catch(err => console.error('Error loading config:', err))
        .finally(() => setIsLoading(false))
    }
  }, [surgeryId, initialConfig, isLoading])

  // Filter symptoms by search term
  const filteredSymptoms = useMemo(() => {
    if (!searchTerm.trim()) return symptoms
    const term = searchTerm.toLowerCase()
    return symptoms.filter(s => 
      s.name.toLowerCase().includes(term) ||
      s.briefInstruction?.toLowerCase().includes(term)
    )
  }, [symptoms, searchTerm])

  // Get selected symptoms in order
  const selectedSymptoms = useMemo(() => {
    const symptomMap = new Map(symptoms.map(s => [s.id, s]))
    return selectedIds
      .map(id => symptomMap.get(id))
      .filter((s): s is EffectiveSymptom => s !== undefined)
  }, [selectedIds, symptoms])

  // Get available symptoms (not already selected)
  const availableSymptoms = useMemo(() => {
    const selectedSet = new Set(selectedIds)
    return filteredSymptoms.filter(s => !selectedSet.has(s.id))
  }, [filteredSymptoms, selectedIds])

  const handleAddSymptom = (symptomId: string) => {
    if (!selectedIds.includes(symptomId)) {
      setSelectedIds([...selectedIds, symptomId])
    }
    setSearchTerm('')
  }

  const handleRemoveSymptom = (symptomId: string) => {
    setSelectedIds(selectedIds.filter(id => id !== symptomId))
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newIds = [...selectedIds]
    ;[newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]]
    setSelectedIds(newIds)
  }

  const handleMoveDown = (index: number) => {
    if (index === selectedIds.length - 1) return
    const newIds = [...selectedIds]
    ;[newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]]
    setSelectedIds(newIds)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      const response = await fetch('/api/admin/surgery-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commonReasons: {
            commonReasonsEnabled: enabled,
            commonReasonsSymptomIds: selectedIds,
            commonReasonsMax: maxChips,
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save')
      }

      setSaveMessage({ type: 'success', text: 'Settings saved successfully' })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      setSaveMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save settings' 
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEnabled(initialConfig?.commonReasonsEnabled ?? false)
    setSelectedIds(initialConfig?.commonReasonsSymptomIds ?? [])
    setMaxChips(initialConfig?.commonReasonsMax ?? 8)
    setSaveMessage(null)
  }

  const hasChanges = useMemo(() => {
    if (!initialConfig) {
      return enabled || selectedIds.length > 0 || maxChips !== 8
    }
    return (
      enabled !== initialConfig.commonReasonsEnabled ||
      JSON.stringify(selectedIds) !== JSON.stringify(initialConfig.commonReasonsSymptomIds) ||
      maxChips !== initialConfig.commonReasonsMax
    )
  }, [enabled, selectedIds, maxChips, initialConfig])

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-32 mb-6"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">
        Common Reasons for Calling
      </h2>

      <div className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 text-nhs-blue border-gray-300 rounded focus:ring-nhs-blue"
            />
            <span className="text-sm font-medium text-gray-700">
              Enable "Common reasons for calling" row
            </span>
          </label>
        </div>

        {enabled && (
          <>
            {/* Max Chips Setting */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum number of chips
              </label>
              <input
                type="number"
                min="0"
                max="20"
                value={maxChips}
                onChange={(e) => setMaxChips(Math.max(0, Math.min(20, parseInt(e.target.value) || 0)))}
                className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum number of chips to display (0-20)
              </p>
            </div>

            {/* Selected Symptoms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selected Symptoms ({selectedSymptoms.length})
              </label>
              {selectedSymptoms.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No symptoms selected</p>
              ) : (
                <div className="space-y-2">
                  {selectedSymptoms.map((symptom, index) => (
                    <div
                      key={symptom.id}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{symptom.name}</div>
                        <div className="text-xs text-gray-500">
                          {symptom.ageGroup} • {symptom.briefInstruction || 'No brief instruction'}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === selectedSymptoms.length - 1}
                          className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveSymptom(symptom.id)}
                          className="px-2 py-1 text-xs bg-red-50 text-red-700 border border-red-300 rounded hover:bg-red-100"
                          aria-label="Remove"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Symptoms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add Symptoms
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search symptoms..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nhs-blue"
                />
                {searchTerm && availableSymptoms.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {availableSymptoms.slice(0, 10).map((symptom) => (
                      <button
                        key={symptom.id}
                        type="button"
                        onClick={() => handleAddSymptom(symptom.id)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                      >
                        <div className="font-medium">{symptom.name}</div>
                        <div className="text-xs text-gray-500">
                          {symptom.ageGroup} • {symptom.briefInstruction || 'No brief instruction'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Save/Cancel Buttons */}
        {hasChanges && (
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-nhs-blue text-white rounded-lg hover:bg-nhs-dark-blue transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Cancel
            </button>
            {saveMessage && (
              <div className={`text-sm ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {saveMessage.text}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

