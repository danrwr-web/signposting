/**
 * High-risk buttons configuration component
 * Allows surgery admins to configure high-risk quick-access buttons
 */

'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { DefaultHighRiskButtonConfig } from '@/lib/api-contracts'
import { Session } from '@/server/auth'

interface HighRiskLink {
  id: string
  label: string
  symptomSlug: string | null
  symptomId: string | null
  orderIndex: number
}

interface HighRiskConfigProps {
  surgeryId?: string
  surgeries?: Array<{ id: string; slug: string; name: string }>
  session?: Session
}

export default function HighRiskConfig({ surgeryId, surgeries, session }: HighRiskConfigProps) {
  const [highRiskLinks, setHighRiskLinks] = useState<HighRiskLink[]>([])
  const [defaultButtons, setDefaultButtons] = useState<DefaultHighRiskButtonConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [enableDefaultHighRisk, setEnableDefaultHighRisk] = useState(true)
  const [editingButton, setEditingButton] = useState<DefaultHighRiskButtonConfig | null>(null)
  const [newLink, setNewLink] = useState({
    label: '',
    symptomSlug: '',
    orderIndex: 0
  })

  useEffect(() => {
    loadHighRiskLinks()
    loadDefaultButtons()
  }, [surgeryId])

  const loadHighRiskLinks = async () => {
    try {
      // Convert surgery ID to slug if needed
      let surgerySlug = surgeryId
      if (surgeryId && surgeries) {
        const surgery = surgeries.find(s => s.id === surgeryId)
        surgerySlug = surgery?.slug
      }
      
      // Build URL with surgery parameter if surgerySlug is provided
      const url = surgerySlug ? `/api/admin/highrisk?surgery=${surgerySlug}` : '/api/admin/highrisk'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        // API returns { links: [...] }, extract the links array
        setHighRiskLinks(data.links || [])
      } else {
        toast.error('Failed to load high-risk buttons')
      }
    } catch (error) {
      console.error('Error loading high-risk links:', error)
      toast.error('Failed to load high-risk buttons')
    }
  }

  const loadDefaultButtons = async () => {
    try {
      // Convert surgery ID to slug if needed
      let surgerySlug = surgeryId
      if (surgeryId && surgeries) {
        const surgery = surgeries.find(s => s.id === surgeryId)
        surgerySlug = surgery?.slug
      }
      
      // Build URL with surgery parameter if surgerySlug is provided
      const url = surgerySlug ? `/api/admin/default-highrisk-buttons?surgery=${surgerySlug}` : '/api/admin/default-highrisk-buttons'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setDefaultButtons(data.buttons || [])
        
        // Determine if any default buttons are enabled
        const hasEnabledButtons = data.buttons?.some((button: DefaultHighRiskButtonConfig) => button.isEnabled)
        setEnableDefaultHighRisk(hasEnabledButtons)
      } else {
        toast.error('Failed to load default button configurations')
      }
    } catch (error) {
      console.error('Error loading default buttons:', error)
      toast.error('Failed to load default button configurations')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddLink = async () => {
    if (!newLink.label.trim()) {
      toast.error('Label is required')
      return
    }

    try {
      // Convert surgery ID to slug if needed
      let surgerySlug = surgeryId
      if (surgeryId && surgeries) {
        const surgery = surgeries.find(s => s.id === surgeryId)
        surgerySlug = surgery?.slug
      }
      
      const url = surgerySlug ? `/api/admin/highrisk?surgery=${surgerySlug}` : '/api/admin/highrisk'
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newLink),
      })

      if (response.ok) {
        toast.success('High-risk button added successfully')
        setShowAddForm(false)
        setNewLink({ label: '', symptomSlug: '', orderIndex: 0 })
        loadHighRiskLinks()
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to add high-risk button')
      }
    } catch (error) {
      console.error('Error adding high-risk link:', error)
      toast.error('Failed to add high-risk button')
    }
  }

  const handleToggleDefaultButtons = async () => {
    try {
      // Convert surgery ID to slug if needed
      let surgerySlug = surgeryId
      if (surgeryId && surgeries) {
        const surgery = surgeries.find(s => s.id === surgeryId)
        surgerySlug = surgery?.slug
      }
      
      const url = surgerySlug ? `/api/admin/highrisk?surgery=${surgerySlug}` : '/api/admin/highrisk'
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enableDefaultHighRisk: !enableDefaultHighRisk }),
      })

      if (response.ok) {
        setEnableDefaultHighRisk(!enableDefaultHighRisk)
        toast.success(`Default buttons ${!enableDefaultHighRisk ? 'enabled' : 'disabled'}`)
        loadHighRiskLinks() // Reload to show updated list
        loadDefaultButtons() // Reload default button configs
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to toggle default buttons')
      }
    } catch (error) {
      console.error('Error toggling default buttons:', error)
      toast.error('Failed to toggle default buttons')
    }
  }

  const handleToggleIndividualButton = async (buttonKey: string, isEnabled: boolean) => {
    try {
      // Convert surgery ID to slug if needed
      let surgerySlug = surgeryId
      if (surgeryId && surgeries) {
        const surgery = surgeries.find(s => s.id === surgeryId)
        surgerySlug = surgery?.slug
      }
      
      const url = surgerySlug ? `/api/admin/default-highrisk-buttons?surgery=${surgerySlug}` : '/api/admin/default-highrisk-buttons'
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ buttonKey, isEnabled }),
      })

      if (response.ok) {
        toast.success(`Button ${isEnabled ? 'enabled' : 'disabled'}`)
        loadHighRiskLinks() // Reload to show updated list
        loadDefaultButtons() // Reload default button configs
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to toggle button')
      }
    } catch (error) {
      console.error('Error toggling individual button:', error)
      toast.error('Failed to toggle button')
    }
  }

  const handleUpdateButton = async (buttonKey: string, label: string, symptomSlug: string) => {
    try {
      // Convert surgery ID to slug if needed
      let surgerySlug = surgeryId
      if (surgeryId && surgeries) {
        const surgery = surgeries.find(s => s.id === surgeryId)
        surgerySlug = surgery?.slug
      }
      
      const url = surgerySlug ? `/api/admin/default-highrisk-buttons?surgery=${surgerySlug}` : '/api/admin/default-highrisk-buttons'
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ buttonKey, label, symptomSlug }),
      })

      if (response.ok) {
        toast.success('Button updated successfully')
        loadHighRiskLinks() // Reload to show updated list
        loadDefaultButtons() // Reload default button configs
        setEditingButton(null)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to update button')
      }
    } catch (error) {
      console.error('Error updating button:', error)
      toast.error('Failed to update button')
    }
  }

  const handleDeleteLink = async (id: string) => {
    if (!confirm('Are you sure you want to delete this high-risk button?')) {
      return
    }

    try {
      // Convert surgery ID to slug if needed
      let surgerySlug = surgeryId
      if (surgeryId && surgeries) {
        const surgery = surgeries.find(s => s.id === surgeryId)
        surgerySlug = surgery?.slug
      }
      
      const url = surgerySlug ? `/api/admin/highrisk/${id}?surgery=${surgerySlug}` : `/api/admin/highrisk/${id}`
      const response = await fetch(url, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('High-risk button deleted successfully')
        loadHighRiskLinks()
      } else {
        toast.error('Failed to delete high-risk button')
      }
    } catch (error) {
      console.error('Error deleting high-risk link:', error)
      toast.error('Failed to delete high-risk button')
    }
  }

  const handleUpdateOrder = async (id: string, newOrder: number) => {
    try {
      // Convert surgery ID to slug if needed
      let surgerySlug = surgeryId
      if (surgeryId && surgeries) {
        const surgery = surgeries.find(s => s.id === surgeryId)
        surgerySlug = surgery?.slug
      }
      
      const url = surgerySlug ? `/api/admin/highrisk/${id}?surgery=${surgerySlug}` : `/api/admin/highrisk/${id}`
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderIndex: newOrder }),
      })

      if (response.ok) {
        loadHighRiskLinks()
      }
    } catch (error) {
      console.error('Error updating order:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-nhs-dark-blue">
          High-Risk Quick Access Buttons
        </h3>
        <div className="flex gap-3">
          <button
            onClick={handleToggleDefaultButtons}
            className={`px-4 py-2 rounded-lg transition-colors ${
              enableDefaultHighRisk 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-400 text-white hover:bg-gray-500'
            }`}
          >
            {enableDefaultHighRisk ? 'Disable Defaults' : 'Enable Defaults'}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-nhs-blue text-white rounded-lg hover:bg-nhs-dark-blue transition-colors"
          >
            Add Custom Button
          </button>
        </div>
      </div>

      {/* Default Buttons Configuration */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-blue-900">Default High-Risk Buttons</h4>
              <p className="text-xs text-blue-700">
                Configure which default buttons are enabled for this surgery
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleDefaultButtons}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              enableDefaultHighRisk 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-400 text-white hover:bg-gray-500'
            }`}
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
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Button Label
                      </label>
                      <input
                        type="text"
                        value={editingButton.label}
                        onChange={(e) => setEditingButton({ ...editingButton, label: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Symptom Slug
                      </label>
                      <input
                        type="text"
                        value={editingButton.symptomSlug}
                        onChange={(e) => setEditingButton({ ...editingButton, symptomSlug: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        editingButton.isEnabled 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {editingButton.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <button
                        onClick={() => handleToggleIndividualButton(editingButton.buttonKey, !editingButton.isEnabled)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          editingButton.isEnabled ? 'bg-green-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            editingButton.isEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleUpdateButton(editingButton.buttonKey, editingButton.label, editingButton.symptomSlug)}
                        className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingButton(null)}
                        className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
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
                    <span className={`text-xs px-2 py-1 rounded ${
                      button.isEnabled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {button.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <button
                      onClick={() => handleToggleIndividualButton(button.buttonKey, !button.isEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        button.isEnabled ? 'bg-green-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          button.isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    {session?.type === 'superuser' && (
                      <button
                        onClick={() => setEditingButton(button)}
                        className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200"
                        title="Edit button (Superuser only)"
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

      {showAddForm && (
        <div className="bg-nhs-light-grey rounded-lg p-4 mb-6">
          <h4 className="text-md font-medium text-nhs-dark-blue mb-3">Add New High-Risk Button</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-nhs-grey mb-1">
                Button Label
              </label>
              <input
                type="text"
                value={newLink.label}
                onChange={(e) => setNewLink({ ...newLink, label: e.target.value })}
                placeholder="e.g., Anaphylaxis, Stroke"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nhs-grey mb-1">
                Symptom Slug
              </label>
              <input
                type="text"
                value={newLink.symptomSlug}
                onChange={(e) => setNewLink({ ...newLink, symptomSlug: e.target.value })}
                placeholder="e.g., anaphylaxis, stroke"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-nhs-grey mb-1">
                Order Index
              </label>
              <input
                type="number"
                value={newLink.orderIndex}
                onChange={(e) => setNewLink({ ...newLink, orderIndex: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              />
            </div>
          </div>
          <div className="flex items-end mt-4 space-x-2">
            <button
              onClick={handleAddLink}
              className="px-4 py-2 bg-nhs-green text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Add Button
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!Array.isArray(highRiskLinks) || highRiskLinks.length === 0 ? (
        <div className="text-center py-8 text-nhs-grey">
          <p>No high-risk buttons configured.</p>
          <p className="text-sm">Click &quot;Add Button&quot; to create your first high-risk quick access button.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(Array.isArray(highRiskLinks) ? highRiskLinks : [])
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((link) => {
              const isDefault = link.id.startsWith('default-')
              return (
                <div key={link.id} className={`flex items-center justify-between rounded-lg p-4 ${
                  isDefault ? 'bg-blue-50 border border-blue-200' : 'bg-nhs-light-grey'
                }`}>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="text-sm font-medium text-nhs-dark-blue">
                        {link.label}
                      </div>
                      {isDefault && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-nhs-grey">
                      Links to: {link.symptomSlug || 'Not configured'}
                    </div>
                    <div className="text-xs text-nhs-grey">
                      Order: {link.orderIndex}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!isDefault && (
                      <>
                        <button
                          onClick={() => handleUpdateOrder(link.id, link.orderIndex - 1)}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleUpdateOrder(link.id, link.orderIndex + 1)}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => handleDeleteLink(link.id)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {isDefault && (
                      <span className="text-xs text-blue-600 font-medium">
                        Default buttons cannot be edited individually
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
