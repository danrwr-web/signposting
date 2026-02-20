'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { HighlightRule } from '@/lib/highlighting'
import { GetHighlightsResZ } from '@/lib/api-contracts'
import { Skeleton } from '@/components/ui/Skeleton'

interface HighlightConfigProps {
  surgeryId?: string
  isSuperuser?: boolean
}

export default function HighlightConfig({ surgeryId, isSuperuser = false }: HighlightConfigProps) {
  const [highlights, setHighlights] = useState<HighlightRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [formMessage, setFormMessage] = useState<{ type: 'error' | 'info'; message: string } | null>(null)
  const [enableBuiltInHighlights, setEnableBuiltInHighlights] = useState<boolean>(true)
  const [enableImageIcons, setEnableImageIcons] = useState<boolean>(true)
  const [newHighlight, setNewHighlight] = useState({
    phrase: '',
    textColor: '#ffffff',
    bgColor: '#6A0DAD',
    isGlobal: false // For superusers to create global rules
  })

  // Load existing highlights
  useEffect(() => {
    // If surgery context changes, clear any in-progress edit to avoid cross-surgery edits.
    setEditingRuleId(null)
    setFormMessage(null)
    setShowAddForm(false)
    setNewHighlight({ phrase: '', textColor: '#ffffff', bgColor: '#6A0DAD', isGlobal: false })
    loadHighlights()
  }, [surgeryId])

  const loadHighlights = async (): Promise<HighlightRule[]> => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Build URL with surgeryId parameter if provided
      let url = '/api/highlights'
      if (surgeryId) {
        url += `?surgeryId=${encodeURIComponent(surgeryId)}`
      }
      
      const response = await fetch(url, { cache: 'no-store' })
      if (response.ok) {
        const json = await response.json()
        const { highlights, enableBuiltInHighlights: builtInEnabled, enableImageIcons: imageIconsEnabled } = GetHighlightsResZ.parse(json)
        const safeHighlights = Array.isArray(highlights) ? (highlights as any) : []
        setHighlights(safeHighlights)
        setEnableBuiltInHighlights(builtInEnabled ?? true)
        setEnableImageIcons(imageIconsEnabled ?? true)
        return safeHighlights
      } else {
        const errorMessage = `Failed to load highlight rules (${response.status})`
        setError(errorMessage)
        toast.error(errorMessage)
        return []
      }
    } catch (error) {
      console.error('Error loading highlights:', error)
      const errorMessage = 'Failed to load highlight rules'
      setError(errorMessage)
      toast.error(errorMessage)
      return []
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setEditingRuleId(null)
    setFormMessage(null)
    setNewHighlight({ phrase: '', textColor: '#ffffff', bgColor: '#6A0DAD', isGlobal: false })
  }

  const startEdit = (rule: HighlightRule & { surgeryId?: string | null }) => {
    setShowAddForm(true)
    setEditingRuleId(rule.id)
    setNewHighlight({
      phrase: rule.phrase,
      textColor: rule.textColor,
      bgColor: rule.bgColor,
      isGlobal: isSuperuser ? (rule.surgeryId === null) : false
    })
  }

  const handleSubmit = async () => {
    const phraseNormalized = newHighlight.phrase.trim().toLowerCase()
    if (!phraseNormalized) {
      setFormMessage({ type: 'error', message: 'Please enter a phrase.' })
      toast.error('Please enter a phrase')
      return
    }

    try {
      setFormMessage(null)

      if (editingRuleId) {
        const response = await fetch(`/api/highlights/${editingRuleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phrase: phraseNormalized,
            textColor: newHighlight.textColor,
            bgColor: newHighlight.bgColor,
          })
        })

        if (response.ok) {
          toast.success('Highlight rule updated')
          resetForm()
          setShowAddForm(false)
          await loadHighlights()
        } else {
          const errorData = await response.json().catch(() => ({}))
          const message = errorData?.error || 'Failed to update highlight rule'
          setFormMessage({ type: 'error', message })
          toast.error(message)
        }

        return
      }

      const response = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phrase: phraseNormalized,
          textColor: newHighlight.textColor,
          bgColor: newHighlight.bgColor,
          isEnabled: true,
          isGlobal: newHighlight.isGlobal && isSuperuser, // Send isGlobal flag for superusers
          surgeryId: surgeryId || undefined // Only include surgeryId if not global
        })
      })

      if (response.ok) {
        toast.success('Highlight rule added successfully')
        resetForm()
        setShowAddForm(false)
        await loadHighlights()
        return
      }

      if (response.status === 409) {
        // Friendly recovery path: switch into edit mode for the existing rule.
        const targetPhrase = phraseNormalized
        const updated = await loadHighlights()

        const targetScope =
          isSuperuser && newHighlight.isGlobal
            ? null
            : (surgeryId ?? null)

        const existing = updated.find((h: any) => {
          const samePhrase = (h?.phrase ?? '').toString().trim().toLowerCase() === targetPhrase
          const sameScope = (h?.surgeryId ?? null) === targetScope
          return samePhrase && sameScope
        })

        if (existing) {
          setFormMessage({ type: 'info', message: 'Rule already exists — you can edit it below.' })
          startEdit(existing as any)
          return
        }

        const fallbackMsg = 'Rule already exists — use Edit on the existing rule.'
        setFormMessage({ type: 'error', message: fallbackMsg })
        toast.error(fallbackMsg)
        return
      }

      const errorData = await response.json().catch(() => ({}))
      const message = errorData?.error || 'Failed to add highlight rule'
      setFormMessage({ type: 'error', message })
      toast.error(message)
    } catch (error) {
      console.error('Error adding highlight:', error)
      setFormMessage({ type: 'error', message: 'Failed to save highlight rule' })
      toast.error('Failed to add highlight rule')
    }
  }

  const handleDeleteHighlight = async (id: string) => {
    if (!confirm('Are you sure you want to delete this highlight rule?')) {
      return
    }

    const deletedRule = highlights.find(h => h.id === id)
    // Optimistic: remove from list immediately
    setHighlights(prev => prev.filter(h => h.id !== id))
    toast.success('Highlight rule deleted')

    try {
      const response = await fetch(`/api/highlights/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        // Revert only the specific deleted item back into the list
        if (deletedRule) {
          setHighlights(prev => [...prev, deletedRule])
        }
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 403) {
          toast.error(errorData.error || 'You do not have permission to delete this rule')
        } else {
          toast.error(errorData.error || 'Failed to delete highlight rule')
        }
      }
    } catch (error) {
      // Revert only the specific deleted item
      if (deletedRule) {
        setHighlights(prev => [...prev, deletedRule])
      }
      console.error('Error deleting highlight:', error)
      toast.error('Failed to delete highlight rule — reverted')
    }
  }

  const handleToggleActive = async (id: string, isEnabled: boolean) => {
    const previousValue = highlights.find(h => h.id === id)?.isEnabled
    // Optimistic: toggle in local state immediately
    setHighlights(prev =>
      prev.map(h => h.id === id ? { ...h, isEnabled } : h)
    )

    try {
      const response = await fetch(`/api/highlights/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled })
      })

      if (response.ok) {
        toast.success(`Highlight rule ${isEnabled ? 'enabled' : 'disabled'}`)
      } else {
        // Revert only the specific item's toggle
        setHighlights(prev =>
          prev.map(h => h.id === id ? { ...h, isEnabled: previousValue ?? !isEnabled } : h)
        )
        toast.error('Failed to update highlight rule')
      }
    } catch (error) {
      // Revert only the specific item's toggle
      setHighlights(prev =>
        prev.map(h => h.id === id ? { ...h, isEnabled: previousValue ?? !isEnabled } : h)
      )
      console.error('Error updating highlight:', error)
      toast.error('Failed to update highlight rule — reverted')
    }
  }

  const handleToggleImageIcons = async (enabled: boolean) => {
    if (!surgeryId) {
      toast.error('Cannot update image icons setting without surgery context')
      return
    }

    const previous = enableImageIcons
    // Optimistic: toggle immediately
    setEnableImageIcons(enabled)

    try {
      const response = await fetch(`/api/admin/surgery-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enableImageIcons: enabled })
      })

      if (response.ok) {
        toast.success(`Image icons ${enabled ? 'enabled' : 'disabled'}`)
      } else {
        setEnableImageIcons(previous)
        const errorData = await response.json().catch(() => ({}))
        toast.error(`Failed to update image icons setting: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      setEnableImageIcons(previous)
      console.error('Error updating image icons setting:', error)
      toast.error('Failed to update image icons setting')
    }
  }

  const handleToggleBuiltInHighlights = async (enabled: boolean) => {
    if (!surgeryId) {
      toast.error('Cannot update built-in highlights setting without surgery context')
      return
    }

    const previous = enableBuiltInHighlights
    // Optimistic: toggle immediately
    setEnableBuiltInHighlights(enabled)

    try {
      const response = await fetch(`/api/admin/surgery-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enableBuiltInHighlights: enabled })
      })

      if (response.ok) {
        toast.success(`Built-in highlights ${enabled ? 'enabled' : 'disabled'}`)
      } else {
        setEnableBuiltInHighlights(previous)
        const errorData = await response.json().catch(() => ({}))
        toast.error(`Failed to update built-in highlights setting: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      setEnableBuiltInHighlights(previous)
      console.error('Error updating built-in highlights setting:', error)
      toast.error('Failed to update built-in highlights setting')
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-nhs-dark-blue mb-4">
          Highlight Configuration
        </h3>
        <div className="space-y-3 animate-pulse">
          {/* Toggle skeletons */}
          <div className="bg-blue-50 rounded-lg p-4">
            <Skeleton height="h-4" width="w-36" className="mb-3" />
            <div className="flex items-center justify-between">
              <Skeleton height="h-3" width="w-64" />
              <Skeleton height="h-8" width="w-20" rounded="lg" />
            </div>
          </div>
          {/* Rule skeletons */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between bg-nhs-light-grey rounded-lg p-4">
              <div className="flex items-center gap-4">
                <Skeleton height="h-7" width="w-24" rounded="md" />
                <Skeleton height="h-3" width="w-40" />
              </div>
              <div className="flex gap-2">
                <Skeleton height="h-7" width="w-16" rounded="md" />
                <Skeleton height="h-7" width="w-12" rounded="md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-nhs-dark-blue mb-4">
          Highlight Configuration
        </h3>
        <div className="text-center py-8">
          <div className="text-red-600 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-red-600 mb-4">Couldn&apos;t load highlight rules</p>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadHighlights}
            className="px-4 py-2 bg-nhs-blue text-white rounded-lg hover:bg-nhs-dark-blue transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-nhs-dark-blue">
          Highlight Configuration
        </h3>
        <button
          onClick={() => {
            if (showAddForm) {
              setShowAddForm(false)
              resetForm()
              return
            }
            setFormMessage(null)
            setShowAddForm(true)
          }}
          className="px-4 py-2 bg-nhs-blue text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
        >
          {showAddForm ? (editingRuleId ? 'Cancel edit' : 'Cancel') : 'Add Rule'}
        </button>
      </div>

      {/* Built-in Highlights Toggle */}
      {surgeryId && (
        <div className="space-y-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-md font-medium text-nhs-dark-blue mb-3">Built-in Highlights</h4>
            <div className="flex items-center justify-between">
              <div className="text-sm text-nhs-grey">
                <p>Enable or disable built-in highlighting for slot types (green slot, orange slot, etc.)</p>
              </div>
              <button
                onClick={() => handleToggleBuiltInHighlights(!enableBuiltInHighlights)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  enableBuiltInHighlights
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {enableBuiltInHighlights ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="text-md font-medium text-nhs-dark-blue mb-3">Image Icons</h4>
            <div className="flex items-center justify-between">
              <div className="text-sm text-nhs-grey">
                <p>Enable or disable image icons on symptom cards when phrases match</p>
              </div>
              <button
                onClick={() => handleToggleImageIcons(!enableImageIcons)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  enableImageIcons
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {enableImageIcons ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Highlight Form */}
      {showAddForm && (
        <div className="bg-nhs-light-grey rounded-lg p-4 mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h4 className="text-md font-medium text-nhs-dark-blue">
              {editingRuleId ? 'Edit Highlight Rule' : 'Add New Highlight Rule'}
            </h4>
            {editingRuleId && (
              <button
                type="button"
                onClick={() => {
                  resetForm()
                }}
                className="text-sm text-nhs-blue underline hover:text-nhs-dark-blue"
              >
                Cancel edit
              </button>
            )}
          </div>

          {formMessage && (
            <div
              className={`rounded-lg px-3 py-2 mb-3 text-sm ${
                formMessage.type === 'error'
                  ? 'bg-red-50 text-red-800'
                  : 'bg-blue-50 text-nhs-dark-blue'
              }`}
              role={formMessage.type === 'error' ? 'alert' : 'status'}
              aria-live="polite"
            >
              {formMessage.message}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="highlight-phrase" className="block text-sm font-medium text-nhs-grey mb-1">
                Phrase
              </label>
              <input
                id="highlight-phrase"
                type="text"
                value={newHighlight.phrase}
                onChange={(e) => setNewHighlight({ ...newHighlight, phrase: e.target.value })}
                placeholder="e.g., pharmacy first, emergency"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              />
            </div>
            <div>
              <label htmlFor="highlight-text-colour" className="block text-sm font-medium text-nhs-grey mb-1">
                Text Color
              </label>
              <input
                id="highlight-text-colour"
                type="color"
                value={newHighlight.textColor}
                onChange={(e) => setNewHighlight({ ...newHighlight, textColor: e.target.value })}
                className="w-full h-10 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="highlight-bg-colour" className="block text-sm font-medium text-nhs-grey mb-1">
                Background Color
              </label>
              <input
                id="highlight-bg-colour"
                type="color"
                value={newHighlight.bgColor}
                onChange={(e) => setNewHighlight({ ...newHighlight, bgColor: e.target.value })}
                className="w-full h-10 border border-gray-300 rounded-lg"
              />
            </div>
            {isSuperuser && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isGlobal"
                  checked={newHighlight.isGlobal}
                  onChange={(e) => setNewHighlight({ ...newHighlight, isGlobal: e.target.checked })}
                  className="rounded border-gray-300 text-nhs-blue focus:ring-nhs-blue"
                />
                <label htmlFor="isGlobal" className="text-sm text-nhs-grey">
                  Global rule (applies to all surgeries)
                </label>
              </div>
            )}
            <div className="flex items-end">
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-nhs-green text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                {editingRuleId ? 'Save changes' : 'Add Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Highlights */}
      <div className="space-y-3">
        {Array.isArray(highlights) && highlights.length === 0 ? (
          <div className="text-center py-8 text-nhs-grey">
            <p>No custom highlight rules configured.</p>
            <p className="text-sm">Click &quot;Add Rule&quot; to create your first custom highlight.</p>
          </div>
        ) : (
          Array.isArray(highlights) && highlights.map((highlight) => (
            <div key={highlight.id} className="flex items-center justify-between bg-nhs-light-grey rounded-lg p-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span
                    className="px-2 py-1 rounded text-sm font-medium"
                    style={{
                      color: highlight.textColor,
                      backgroundColor: highlight.bgColor
                    }}
                  >
                    {highlight.phrase}
                  </span>
                  <span className="text-sm text-nhs-grey">
                    Preview
                  </span>
                </div>
                <div className="text-sm text-nhs-grey">
                  <span className="font-medium">Text:</span> {highlight.textColor} | 
                  <span className="font-medium"> Background:</span> {highlight.bgColor}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleToggleActive(highlight.id, !highlight.isEnabled)}
                  className={`px-3 py-1 rounded text-sm ${
                    highlight.isEnabled 
                      ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {highlight.isEnabled ? 'Enabled' : 'Disabled'}
                </button>
                {(isSuperuser || (highlight as any).surgeryId !== null) && (
                  <button
                    onClick={() => {
                      setFormMessage(null)
                      startEdit(highlight as any)
                    }}
                    className="px-3 py-1 bg-blue-100 text-nhs-dark-blue rounded text-sm hover:bg-blue-200"
                  >
                    Edit
                  </button>
                )}
                {/* Only show delete button for rules that can be deleted */}
                {(isSuperuser || (highlight as any).surgeryId !== null) && (
                  <button
                    onClick={() => handleDeleteHighlight(highlight.id)}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                  >
                    Delete
                  </button>
                )}
                {/* Show indicator for global rules that can't be deleted by surgery admins */}
                {!isSuperuser && (highlight as any).surgeryId === null && (
                  <span className="text-xs text-blue-600 font-medium">
                    Global rule
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Built-in Highlights Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-nhs-dark-blue mb-2">Built-in Highlights</h4>
        <div className="text-sm text-nhs-grey space-y-1">
          <div className="flex items-center space-x-2">
            <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">green slot</span>
            <span className="bg-orange-600 text-white px-2 py-1 rounded text-xs">orange slot</span>
            <span className="bg-red-600 text-white px-2 py-1 rounded text-xs">red slot</span>
            <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs">pink/purple</span>
          </div>
          <p>These are automatically applied to all instruction text.</p>
        </div>
      </div>
    </div>
  )
}
