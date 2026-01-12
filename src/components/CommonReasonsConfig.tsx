/**
 * Common Reasons for Calling configuration component
 * Allows surgery admins to configure the common reasons row on the landing page
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import { CommonReasonsConfig, UiConfig, CommonReasonsItem } from '@/lib/commonReasons'
import { useRouter } from 'next/navigation'

interface CommonReasonsConfigProps {
  surgeryId?: string
  symptoms: EffectiveSymptom[]
  initialConfig?: CommonReasonsConfig | null
}

export default function CommonReasonsConfig({ surgeryId, symptoms, initialConfig }: CommonReasonsConfigProps) {
  const router = useRouter()
  
  // Normalize initial config: convert legacy symptomIds to items format
  const normalizeInitialItems = (config: CommonReasonsConfig | null | undefined): CommonReasonsItem[] => {
    if (!config) return []
    if (config.items && Array.isArray(config.items)) {
      return config.items
    }
    if (config.commonReasonsSymptomIds && Array.isArray(config.commonReasonsSymptomIds)) {
      return config.commonReasonsSymptomIds.map(id => ({ symptomId: id }))
    }
    return []
  }

  const [enabled, setEnabled] = useState(initialConfig?.commonReasonsEnabled ?? false)
  const [items, setItems] = useState<CommonReasonsItem[]>(normalizeInitialItems(initialConfig))
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
              setItems(normalizeInitialItems(uiConfig.commonReasons))
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

  // Get selected symptoms with labels in order
  const selectedItems = useMemo(() => {
    const symptomMap = new Map(symptoms.map(s => [s.id, s]))
    return items
      .map(item => {
        const symptom = symptomMap.get(item.symptomId)
        return symptom ? { item, symptom } : null
      })
      .filter((x): x is { item: CommonReasonsItem; symptom: EffectiveSymptom } => x !== null)
  }, [items, symptoms])

  // Get available symptoms (not already selected)
  const availableSymptoms = useMemo(() => {
    const selectedSet = new Set(items.map(i => i.symptomId))
    return filteredSymptoms.filter(s => !selectedSet.has(s.id))
  }, [filteredSymptoms, items])

  const handleAddSymptom = (symptomId: string) => {
    if (!items.some(i => i.symptomId === symptomId)) {
      setItems([...items, { symptomId }])
    }
    setSearchTerm('')
  }

  const handleRemoveSymptom = (symptomId: string) => {
    setItems(items.filter(i => i.symptomId !== symptomId))
  }

  const handleUpdateLabel = (symptomId: string, label: string) => {
    // Allow spaces during typing - only normalize on save
    setItems(items.map(i => 
      i.symptomId === symptomId 
        ? { ...i, label: label || undefined }
        : i
    ))
  }

  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newItems = [...items]
    ;[newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]]
    setItems(newItems)
  }

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return
    const newItems = [...items]
    ;[newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]]
    setItems(newItems)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      // Normalize items: trim labels, collapse multiple spaces, convert empty strings to undefined
      const normalizedItems = items.map(item => {
        let label = item.label?.trim()
        if (label) {
          // Collapse multiple internal spaces to single space
          label = label.replace(/\s+/g, ' ')
        }
        return {
          symptomId: item.symptomId,
          label: label || undefined
        }
      })

      const response = await fetch('/api/admin/surgery-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commonReasons: {
            commonReasonsEnabled: enabled,
            items: normalizedItems,
            commonReasonsMax: maxChips,
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save')
      }

      setSaveMessage({ type: 'success', text: 'Settings saved successfully' })
      router.refresh()
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
    setItems(normalizeInitialItems(initialConfig))
    setMaxChips(initialConfig?.commonReasonsMax ?? 8)
    setSaveMessage(null)
  }

  const hasChanges = useMemo(() => {
    if (!initialConfig) {
      return enabled || items.length > 0 || maxChips !== 8
    }
    const initialItems = normalizeInitialItems(initialConfig)
    return (
      enabled !== initialConfig.commonReasonsEnabled ||
      JSON.stringify(items) !== JSON.stringify(initialItems) ||
      maxChips !== initialConfig.commonReasonsMax
    )
  }, [enabled, items, maxChips, initialConfig])

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
                Selected Symptoms ({selectedItems.length})
              </label>
              {selectedItems.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No symptoms selected</p>
              ) : (
                <div className="space-y-3">
                  {selectedItems.map(({ item, symptom }, index) => (
                    <div
                      key={symptom.id}
                      className="p-3 bg-gray-50 rounded border border-gray-200 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900">{symptom.name}</div>
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
                            disabled={index === selectedItems.length - 1}
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
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Button label (optional)
                        </label>
                        <input
                          type="text"
                          value={item.label || ''}
                          onChange={(e) => handleUpdateLabel(symptom.id, e.target.value)}
                          placeholder={symptom.name}
                          maxLength={32}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-nhs-blue"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Leave blank to use the symptom name
                        </p>
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

