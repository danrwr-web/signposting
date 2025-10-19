'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { signOut } from 'next-auth/react'
import SimpleHeader from '@/components/SimpleHeader'
import HighlightConfig from '@/components/HighlightConfig'
import HighRiskConfig from '@/components/HighRiskConfig'
import { Surgery } from '@prisma/client'
import { HighlightRule } from '@/lib/highlighting'
import { Session } from '@/server/auth'
import { GetEffectiveSymptomsResZ, GetHighlightsResZ } from '@/lib/api-contracts'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'

interface AdminPageClientProps {
  surgeries: Surgery[]
  symptoms: any[] // Legacy prop, not used anymore
  session: Session
  currentSurgerySlug?: string
}

export default function AdminPageClient({ surgeries, symptoms, session, currentSurgerySlug }: AdminPageClientProps) {
  const [activeTab, setActiveTab] = useState('data')
  const [selectedSurgery, setSelectedSurgery] = useState('')
  const [selectedSymptom, setSelectedSymptom] = useState('')
  const [overrideData, setOverrideData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [editingMode, setEditingMode] = useState<'base' | 'override'>('override')
  const [showAddSymptomForm, setShowAddSymptomForm] = useState(false)
  const [showRemoveSymptomDialog, setShowRemoveSymptomDialog] = useState(false)
  const [symptomToRemove, setSymptomToRemove] = useState('')
  const [showHiddenSymptomsDialog, setShowHiddenSymptomsDialog] = useState(false)
  const [hiddenSymptoms, setHiddenSymptoms] = useState<Array<{
    surgery: { id: string; name: string; slug: string }
    symptoms: Array<{
      id: string
      slug: string
      name: string
      ageGroup: string
      briefInstruction: string | null
      highlightedText: string | null
      instructions: string | null
      linkToPage: string | null
      overrideId: string
    }>
  }>>([])
  const [newSymptom, setNewSymptom] = useState({
    name: '',
    slug: '',
    ageGroup: 'Adult',
    briefInstruction: '',
    instructions: '',
    highlightedText: '',
    linkToPage: ''
  })

  const [highlightRules, setHighlightRules] = useState<HighlightRule[]>([])
  const [effectiveSymptoms, setEffectiveSymptoms] = useState<EffectiveSymptom[]>([])

  // Load highlight rules from API
  useEffect(() => {
    const loadHighlightRules = async () => {
      try {
        const response = await fetch('/api/highlights', { cache: 'no-store' })
        if (response.ok) {
          try {
            const json = await response.json()
            const { highlights } = GetHighlightsResZ.parse(json)
            // Filter out rules with undefined createdAt/updatedAt and ensure proper typing
            const validHighlights = Array.isArray(highlights) 
              ? highlights.filter((rule): rule is HighlightRule => 
                  rule.createdAt !== undefined && rule.updatedAt !== undefined
                )
              : []
            setHighlightRules(validHighlights)
          } catch (error) {
            console.error('Failed to load highlight rules:', error)
            setHighlightRules([])
            toast.error('Failed to load highlight rules')
          }
        }
      } catch (error) {
        console.error('Failed to fetch highlight rules:', error)
        setHighlightRules([])
        toast.error('Failed to load highlight rules')
      }
    }
    loadHighlightRules()
  }, [])

  // Load effective symptoms for override dropdown
  const loadEffectiveSymptoms = async () => {
    if (editingMode === 'override' && !selectedSurgery) return
    
    try {
      // For base symptom editing, we need to fetch fresh data from the API
      if (editingMode === 'base') {
        // Add cache-busting parameter to ensure fresh data
        const timestamp = Date.now()
        const response = await fetch(`/api/admin/symptoms?t=${timestamp}`, {
          cache: 'no-store'
        })
        if (response.ok) {
          const freshSymptoms = await response.json()
          const validSymptoms = Array.isArray(freshSymptoms) 
            ? freshSymptoms.filter((symptom): symptom is EffectiveSymptom => 
                symptom.slug !== undefined
              ).sort((a, b) => a.name.localeCompare(b.name))
            : []
          setEffectiveSymptoms(validSymptoms)
        } else {
          throw new Error('Failed to fetch symptoms')
        }
      } else {
        // For override mode, use the symptoms data passed from the server
        const validSymptoms = Array.isArray(symptoms) 
          ? symptoms.filter((symptom): symptom is EffectiveSymptom => 
              symptom.slug !== undefined
            ).sort((a, b) => a.name.localeCompare(b.name))
          : []
        setEffectiveSymptoms(validSymptoms)
      }
    } catch (error) {
      console.error('Error loading symptoms:', error)
      toast.error('Failed to load symptoms')
    }
  }

  // Initialize selected surgery based on session type
  useEffect(() => {
    if (session.type === 'surgery' && session.surgeryId) {
      setSelectedSurgery(session.surgeryId)
    } else if (session.type === 'superuser' && surgeries.length > 0) {
      // For superuser, default to first surgery
      setSelectedSurgery(surgeries[0].id)
    }
  }, [session, surgeries])

  // Load effective symptoms when surgery is selected or editing mode changes
  useEffect(() => {
    if (editingMode === 'base' || (editingMode === 'override' && selectedSurgery)) {
      loadEffectiveSymptoms()
    }
  }, [selectedSurgery, editingMode])

  // Load override data when symptom is selected
  useEffect(() => {
    if (selectedSymptom && (editingMode === 'override' ? selectedSurgery : true)) {
      loadOverrideData()
    }
  }, [selectedSymptom, selectedSurgery, editingMode])

  const handleLogout = async () => {
    try {
      await signOut({ callbackUrl: '/' })
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Failed to logout')
    }
  }

  const highlightText = (text: string) => {
    const { applyHighlightRules } = require('@/lib/highlighting')
    // Ensure highlightRules is an array
    const rules = Array.isArray(highlightRules) ? highlightRules : []
    return applyHighlightRules(text, rules)
  }


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/upload-excel', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(`Excel processed: ${result.stats.created} created, ${result.stats.updated} updated`)
        // Refresh the page to show updated data
        window.location.reload()
      } else {
        throw new Error(result.error || 'Unknown error')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload Excel file'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const loadOverrideData = async () => {
    if (!selectedSymptom) return
    if (editingMode === 'override' && !selectedSurgery) return

    setIsLoading(true)
    try {
      if (editingMode === 'base') {
        // For base symptom editing, find the symptom from the list
        const baseSymptom = effectiveSymptoms.find(s => s.id === selectedSymptom)
        if (baseSymptom) {
          setOverrideData({
            baseSymptom: baseSymptom,
            // Initialize with current base values for editing
            name: baseSymptom.name,
            ageGroup: baseSymptom.ageGroup,
            briefInstruction: baseSymptom.briefInstruction || '',
            instructions: baseSymptom.instructions || '',
            highlightedText: baseSymptom.highlightedText || '',
            linkToPage: baseSymptom.linkToPage || ''
          })
        } else {
          toast.error('Symptom not found')
        }
      } else {
        // For override editing, fetch from API
        const response = await fetch(
          `/api/admin/overrides?surgeryId=${selectedSurgery}&baseId=${selectedSymptom}`
        )
        
        if (!response.ok) {
          throw new Error('Failed to fetch override data')
        }
        
        const data = await response.json()
        
        // If no override exists, create a structure with base symptom data
        if (!data) {
          // Find the base symptom from effective symptoms
          const baseSymptom = effectiveSymptoms.find(s => s.id === selectedSymptom)
          if (baseSymptom) {
            setOverrideData({
              baseSymptom: baseSymptom,
              // Initialize override fields as empty (will inherit from base)
              name: '',
              ageGroup: '',
              briefInstruction: '',
              instructions: '',
              highlightedText: '',
              linkToPage: ''
            })
          } else {
            toast.error('Symptom not found')
          }
        } else {
          // Override exists, use the data but ensure it has baseSymptom
          if (data.baseSymptom) {
            setOverrideData(data)
            toast.success('Override data loaded successfully')
          } else {
            // If baseSymptom is missing, find it from effective symptoms
            const baseSymptom = effectiveSymptoms.find(s => s.id === selectedSymptom)
            if (baseSymptom) {
              setOverrideData({
                ...data,
                baseSymptom: baseSymptom
              })
              toast.success('Override data loaded with base symptom')
            } else {
              toast.error('Base symptom not found')
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading override data:', error)
      toast.error('Failed to load override data')
    } finally {
      setIsLoading(false)
    }
  }

  const saveOverride = async () => {
    if (!selectedSymptom) return
    if (editingMode === 'override' && !selectedSurgery) return

    setIsLoading(true)
    try {
      if (editingMode === 'base') {
        // Save base symptom directly
        const response = await fetch(`/api/admin/symptoms/${selectedSymptom}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'base',
            name: overrideData.name,
            ageGroup: overrideData.ageGroup,
            briefInstruction: overrideData.briefInstruction,
            instructions: overrideData.instructions,
            highlightedText: overrideData.highlightedText,
            linkToPage: overrideData.linkToPage,
          }),
        })

        if (response.ok) {
          toast.success('Base symptom updated successfully')
          // Reload symptoms to reflect changes
          loadEffectiveSymptoms()
        } else {
          throw new Error('Failed to save base symptom')
        }
      } else {
        // Save override
        // Filter out non-schema fields like baseSymptom
        const { baseSymptom, ...overrideFields } = overrideData
        
        const response = await fetch('/api/admin/overrides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            surgeryId: selectedSurgery,
            baseId: selectedSymptom,
            ...overrideFields,
          }),
        })

        if (response.ok) {
          toast.success('Override saved successfully')
          // Clear the form and reload symptoms
          setOverrideData(null)
          setSelectedSymptom('')
          loadEffectiveSymptoms()
        } else {
          const errorData = await response.json()
          console.error('Override save failed:', errorData)
          const errorMessage = errorData.details ? `${errorData.error} - ${errorData.details}` : errorData.error || 'Unknown error'
          toast.error(`Override save failed: ${errorMessage}`)
          throw new Error(`Failed to save override: ${errorMessage}`)
        }
      }
    } catch (error) {
      console.error('Error saving:', error)
      toast.error(`Failed to save ${editingMode === 'base' ? 'base symptom' : 'override'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddSymptom = async () => {
    if (!newSymptom.name || !newSymptom.slug) {
      toast.error('Please fill in name and slug fields')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSymptom),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Symptom added successfully')
        setNewSymptom({
          name: '',
          slug: '',
          ageGroup: 'Adult',
          briefInstruction: '',
          instructions: '',
          highlightedText: '',
          linkToPage: ''
        })
        setShowAddSymptomForm(false)
        // Reload symptoms to show the new one
        loadEffectiveSymptoms()
      } else {
        const errorData = await response.json()
        console.error('Add symptom failed:', errorData)
        toast.error(`Failed to add symptom: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error adding symptom:', error)
      toast.error('Failed to add symptom')
    } finally {
      setIsLoading(false)
    }
  }

  const loadHiddenSymptoms = async () => {
    if (session.type !== 'superuser') return
    
    try {
      const response = await fetch('/api/admin/hidden-symptoms', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        setHiddenSymptoms(data.hiddenSymptoms || [])
      } else {
        toast.error('Failed to load hidden symptoms')
      }
    } catch (error) {
      console.error('Error loading hidden symptoms:', error)
      toast.error('Failed to load hidden symptoms')
    }
  }

  const handleRestoreSymptom = async (symptomId: string, surgeryId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/symptoms/${symptomId}?action=restore&surgeryId=${surgeryId}`, {
        method: 'POST',
      })

      if (response.ok) {
        toast.success('Symptom restored successfully')
        loadHiddenSymptoms() // Reload the list
      } else {
        toast.error('Failed to restore symptom')
      }
    } catch (error) {
      console.error('Error restoring symptom:', error)
      toast.error('Failed to restore symptom')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveSymptom = async () => {
    if (!symptomToRemove) return

    setIsLoading(true)
    try {
      const selectedSymptomData = effectiveSymptoms.find(s => s.id === symptomToRemove)
      if (!selectedSymptomData) {
        toast.error('Symptom not found')
        return
      }

      console.log('AdminPageClient: Session object:', session)
      console.log('AdminPageClient: Session type:', session.type)
      console.log('AdminPageClient: Session surgeryId:', session.surgeryId)

      let url = `/api/admin/symptoms/${symptomToRemove}?source=${selectedSymptomData.source}`
      
      if (session.type === 'superuser' && selectedSymptomData.source === 'base') {
        // Superuser permanent deletion
        url += '&action=permanent'
      } else if (session.type === 'surgery' && selectedSymptomData.source === 'base') {
        // Surgery admin hiding symptom
        url += '&action=hide'
        // Add surgeryId parameter for surgery admin operations
        if (session.surgeryId) {
          url += `&surgeryId=${session.surgeryId}`
          console.log('AdminPageClient: Added surgeryId to URL:', session.surgeryId)
        } else {
          console.error('AdminPageClient: session.surgeryId is undefined!')
          toast.error('Unable to determine surgery context')
          return
        }
      }

      console.log('AdminPageClient: Final URL:', url)

      const response = await fetch(url, {
        method: 'DELETE',
      })

      if (response.ok) {
        const action = session.type === 'superuser' && selectedSymptomData.source === 'base' ? 'permanently deleted' : 'removed'
        toast.success(`Symptom ${action} successfully`)
        setShowRemoveSymptomDialog(false)
        setSymptomToRemove('')
        // Refresh the page to update symptom list
        window.location.reload()
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
        console.error('Delete failed:', errorData)
        toast.error(`Failed to remove symptom: ${errorData.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error removing symptom:', error)
      toast.error('Failed to remove symptom')
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={surgeries} currentSurgeryId={undefined} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-nhs-dark-blue">
              Admin Dashboard
            </h1>
            <p className="text-nhs-grey mt-1">
              Logged in as {session.email} ({session.type === 'surgery' ? 'Surgery Admin' : 'Superuser'})
              {session.surgerySlug && ` • ${session.surgerySlug}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'data', label: 'Data Management' },
                { id: 'overrides', label: 'Overrides' },
                { id: 'highlights', label: 'Highlight Config' },
                { id: 'highrisk', label: 'High-Risk Buttons' },
                { id: 'engagement', label: 'Engagement' },
                { id: 'suggestions', label: 'Suggestions' },
                ...(session.type === 'surgery' ? [{ id: 'users', label: 'User Management' }] : []),
                ...(session.type === 'superuser' ? [{ id: 'system', label: 'System Management' }] : []),
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-nhs-blue text-nhs-blue'
                      : 'border-transparent text-nhs-grey hover:text-nhs-blue hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Data Management Tab */}
            {activeTab === 'data' && (
              <div className="space-y-6">
                {/* Symptom Management */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-nhs-dark-blue">
                      Symptom Management
                    </h2>
                    <div className="space-x-2">
                      <button
                        onClick={() => setShowAddSymptomForm(true)}
                        className="px-4 py-2 bg-nhs-green text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                      >
                        Add Symptom
                      </button>
                      <button
                        onClick={() => setShowRemoveSymptomDialog(true)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                      >
                        {session.type === 'superuser' ? 'Delete Symptom' : 'Hide Symptom'}
                      </button>
                      {session.type === 'superuser' && (
                        <button
                          onClick={() => {
                            setShowHiddenSymptomsDialog(true)
                            loadHiddenSymptoms()
                          }}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                        >
                          Manage Hidden Symptoms
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-nhs-grey mb-4">
                    Add new symptoms manually or remove existing ones from the database.
                  </p>
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-nhs-dark-blue mb-4">
                    Upload Excel File
                  </h2>
                  <p className="text-nhs-grey mb-4">
                    Upload an Excel file to seed or refresh the base symptom database.
                    Expected columns: Symptom, AgeGroup, BriefInstruction, Instructions, 
                    HighlightedText (optional), LinkToPage (optional), CustomID (optional).
                  </p>
                  <div className="border-2 border-dashed border-nhs-grey rounded-lg p-6">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      disabled={isLoading}
                      className="w-full"
                    />
                    {isLoading && (
                      <p className="text-nhs-blue mt-2">Processing file...</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-nhs-dark-blue mb-3">
                    Current Base Symptoms ({symptoms.length})
                  </h3>
                  <div className="bg-nhs-light-grey rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {symptoms.map((symptom) => (
                        <div key={symptom.id} className="bg-white p-3 rounded border">
                          <div className="font-medium text-nhs-dark-blue">
                            {symptom.name}
                          </div>
                            <div 
                              className="text-sm text-nhs-grey"
                              dangerouslySetInnerHTML={{ 
                                __html: `${symptom.ageGroup} • ${highlightText(symptom.briefInstruction)}` 
                              }}
                            />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Overrides Tab */}
            {activeTab === 'overrides' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-nhs-dark-blue mb-4">
                    {session.type === 'superuser' ? 'Manage Symptoms & Overrides' : 'Manage Surgery Overrides'}
                  </h2>
                  
                  {/* Editing Mode Selector for Superusers */}
                  {session.type === 'superuser' && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-nhs-grey mb-2">
                        Editing Mode
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="override"
                            checked={editingMode === 'override'}
                            onChange={(e) => setEditingMode(e.target.value as 'base' | 'override')}
                            className="mr-2"
                          />
                          Surgery Overrides
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="base"
                            checked={editingMode === 'base'}
                            onChange={(e) => setEditingMode(e.target.value as 'base' | 'override')}
                            className="mr-2"
                          />
                          Base Symptoms
                        </label>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Surgery Selector - only show for superusers or when editing overrides */}
                    {(session.type === 'superuser' || editingMode === 'override') && (
                      <div>
                        <label className="block text-sm font-medium text-nhs-grey mb-1">
                          Select Surgery
                        </label>
                        <select
                          value={selectedSurgery}
                          onChange={(e) => setSelectedSurgery(e.target.value)}
                          className="w-full nhs-input"
                          disabled={session.type === 'surgery'}
                        >
                          <option value="">Choose surgery...</option>
                          {surgeries.map((surgery) => (
                            <option key={surgery.id} value={surgery.id}>
                              {surgery.name}
                            </option>
                          ))}
                        </select>
                        {session.type === 'surgery' && (
                          <p className="text-xs text-nhs-grey mt-1">
                            Editing overrides for your surgery only
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-nhs-grey mb-1">
                        Select Symptom
                      </label>
                      <select
                        value={selectedSymptom}
                        onChange={(e) => setSelectedSymptom(e.target.value)}
                        className="w-full nhs-input"
                      >
                        <option value="">Choose symptom...</option>
                        {effectiveSymptoms.length === 0 ? (
                          <option value="" disabled>No symptoms found - try clearing filters</option>
                        ) : (
                          effectiveSymptoms.map((symptom) => (
                            <option key={symptom.id} value={symptom.id}>
                              {symptom.name} ({symptom.source})
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={loadOverrideData}
                    disabled={
                      (editingMode === 'override' && !selectedSurgery) || 
                      !selectedSymptom || 
                      isLoading
                    }
                    className="nhs-button mb-6"
                  >
                    {editingMode === 'base' ? 'Load Base Symptom' : 'Load Override Data'}
                  </button>

                  {overrideData && (
                    <div className="bg-nhs-light-grey rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-nhs-dark-blue mb-4">
                        {editingMode === 'base' ? 'Base Symptom Fields' : 'Override Fields'}
                      </h3>
                      <div className="space-y-4">
                        {[
                          { key: 'symptom', label: 'Symptom Name' },
                          { key: 'ageGroup', label: 'Age Group' },
                          { key: 'briefInstruction', label: 'Brief Instruction' },
                          { key: 'instructions', label: 'Instructions' },
                          { key: 'highlightedText', label: 'Highlighted Text' },
                          { key: 'linkToPage', label: 'Link to Page' },
                        ].map((field) => (
                          <div key={field.key}>
                            <label className="block text-sm font-medium text-nhs-grey mb-1">
                              {field.label}
                            </label>
                              <div className="mb-2">
                                <span className="text-xs text-nhs-grey">Base value: </span>
                                <span 
                                  className="text-sm"
                                  dangerouslySetInnerHTML={{ 
                                    __html: highlightText(overrideData.baseSymptom?.[field.key] || 'N/A') 
                                  }}
                                />
                              </div>
                            <input
                              type="text"
                              value={overrideData[field.key] || ''}
                              onChange={(e) => setOverrideData({
                                ...overrideData,
                                [field.key]: e.target.value
                              })}
                              className="w-full nhs-input"
                              placeholder={`Override ${field.label} (leave empty to inherit from base)`}
                            />
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex space-x-3 mt-6">
                        <button
                          onClick={saveOverride}
                          disabled={isLoading}
                          className="nhs-button"
                        >
                          {editingMode === 'base' ? 'Save Base Symptom' : 'Save Override'}
                        </button>
                        <button
                          onClick={() => setOverrideData(null)}
                          className="nhs-button-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Highlight Config Tab */}
            {activeTab === 'highlights' && (
              <div className="space-y-6">
                <HighlightConfig surgeryId={selectedSurgery} isSuperuser={session?.type === 'superuser'} />
              </div>
            )}

            {/* High-Risk Buttons Tab */}
            {activeTab === 'highrisk' && (
              <div className="space-y-6">
                <HighRiskConfig surgeryId={selectedSurgery} surgeries={surgeries} session={session} />
              </div>
            )}

            {/* Engagement Tab */}
            {activeTab === 'engagement' && (
              <div>
                <h2 className="text-xl font-semibold text-nhs-dark-blue mb-4">
                  Engagement Analytics
                </h2>
                <p className="text-nhs-grey">
                  Engagement analytics will be displayed here. This feature requires 
                  the engagement API to be implemented.
                </p>
              </div>
            )}

            {/* Suggestions Tab */}
            {activeTab === 'suggestions' && (
              <div>
                <h2 className="text-xl font-semibold text-nhs-dark-blue mb-4">
                  User Suggestions
                </h2>
                <p className="text-nhs-grey">
                  User suggestions will be displayed here. This feature requires 
                  the suggestions API to be implemented.
                </p>
              </div>
            )}

            {/* User Management Tab - Only for Surgery Admins */}
            {activeTab === 'users' && session.type === 'surgery' && (
              <div>
                <h2 className="text-xl font-semibold text-nhs-dark-blue mb-4">
                  User Management
                </h2>
                <p className="text-nhs-grey mb-6">
                  Manage users for your surgery. Add new users, change roles, and set default surgeries.
                </p>

                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Surgery User Management
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Manage users who have access to your surgery. You can add new users, 
                    change their roles, and set their default surgery.
                  </p>
                  
                  <div className="flex gap-4">
                    <a
                      href={`/s/${session.surgeryId}/admin/users`}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Manage Users
                    </a>
                    <a
                      href={`/s/${session.surgeryId}`}
                      className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                    >
                      Launch Signposting Tool
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* System Management Tab - Only for Superusers */}
            {activeTab === 'system' && session.type === 'superuser' && (
              <div>
                <h2 className="text-xl font-semibold text-nhs-dark-blue mb-4">
                  System Management
                </h2>
                <p className="text-nhs-grey mb-6">
                  Global system administration and management tools.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Global User Management
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Manage all users across the system, create new users, and assign roles.
                    </p>
                    <a
                      href="/admin/users"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Manage Users
                    </a>
                  </div>

                  <div className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Surgery Management
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Create new surgeries, manage surgery settings, and assign administrators.
                    </p>
                    <a
                      href="/admin/surgeries"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Manage Surgeries
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Symptom Modal */}
      {showAddSymptomForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-nhs-dark-blue mb-4">Add New Symptom</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-nhs-grey mb-1">
                    Symptom Name *
                  </label>
                  <input
                    type="text"
                    value={newSymptom.name}
                    onChange={(e) => setNewSymptom({ ...newSymptom, name: e.target.value })}
                    className="w-full nhs-input"
                    placeholder="e.g., Chest Pain"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-nhs-grey mb-1">
                    Slug *
                  </label>
                  <input
                    type="text"
                    value={newSymptom.slug}
                    onChange={(e) => setNewSymptom({ ...newSymptom, slug: e.target.value })}
                    className="w-full nhs-input"
                    placeholder="e.g., chest-pain"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-nhs-grey mb-1">
                  Age Group *
                </label>
                <select
                  value={newSymptom.ageGroup}
                  onChange={(e) => setNewSymptom({ ...newSymptom, ageGroup: e.target.value })}
                  className="w-full nhs-input"
                >
                  <option value="Adult">Adult</option>
                  <option value="U5">Under 5</option>
                  <option value="O5">5-17</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-nhs-grey mb-1">
                  Brief Instruction *
                </label>
                <input
                  type="text"
                  value={newSymptom.briefInstruction}
                  onChange={(e) => setNewSymptom({ ...newSymptom, briefInstruction: e.target.value })}
                  className="w-full nhs-input"
                  placeholder="Short summary of the instruction"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-nhs-grey mb-1">
                  Instructions *
                </label>
                <textarea
                  value={newSymptom.instructions}
                  onChange={(e) => setNewSymptom({ ...newSymptom, instructions: e.target.value })}
                  className="w-full nhs-input"
                  rows={4}
                  placeholder="Detailed instructions for this symptom"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-nhs-grey mb-1">
                    Highlighted Text
                  </label>
                  <input
                    type="text"
                    value={newSymptom.highlightedText}
                    onChange={(e) => setNewSymptom({ ...newSymptom, highlightedText: e.target.value })}
                    className="w-full nhs-input"
                    placeholder="Important notice (optional)"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-nhs-grey mb-1">
                    Link To Page
                  </label>
                  <input
                    type="text"
                    value={newSymptom.linkToPage}
                    onChange={(e) => setNewSymptom({ ...newSymptom, linkToPage: e.target.value })}
                    className="w-full nhs-input"
                    placeholder="Related page (optional)"
                  />
                </div>
              </div>

            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleAddSymptom}
                disabled={isLoading}
                className="nhs-button"
              >
                {isLoading ? 'Adding...' : 'Add Symptom'}
              </button>
              <button
                onClick={() => setShowAddSymptomForm(false)}
                className="nhs-button-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Symptom Modal */}
      {showRemoveSymptomDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-nhs-dark-blue mb-4">Remove Symptom</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-nhs-grey mb-1">
                Select Symptom to Remove
              </label>
              <select
                value={symptomToRemove}
                onChange={(e) => setSymptomToRemove(e.target.value)}
                className="w-full nhs-input"
              >
                <option value="">Choose a symptom...</option>
                {effectiveSymptoms.map((symptom) => (
                  <option key={symptom.id} value={symptom.id}>
                    {symptom.name} ({symptom.source})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-700">
                <strong>Warning:</strong> {session.type === 'superuser' 
                  ? 'This will permanently delete the symptom and all related data including overrides, engagement events, and suggestions.'
                  : 'This will hide the symptom for your surgery. It can be restored by a superuser.'
                }
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleRemoveSymptom}
                disabled={!symptomToRemove || isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : (session.type === 'superuser' ? 'Delete Symptom' : 'Hide Symptom')}
              </button>
              <button
                onClick={() => {
                  setShowRemoveSymptomDialog(false)
                  setSymptomToRemove('')
                }}
                className="nhs-button-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Symptoms Management Modal */}
      {showHiddenSymptomsDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-nhs-dark-blue mb-4">Manage Hidden Symptoms</h3>
            
            {hiddenSymptoms.length === 0 ? (
              <p className="text-nhs-grey">No hidden symptoms found.</p>
            ) : (
              <div className="space-y-4">
                {hiddenSymptoms.map((surgeryGroup) => (
                  <div key={surgeryGroup.surgery.id} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-nhs-dark-blue mb-3">
                      {surgeryGroup.surgery.name} ({surgeryGroup.surgery.slug})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {surgeryGroup.symptoms.map((symptom: {
                        id: string
                        slug: string
                        name: string
                        ageGroup: string
                        briefInstruction: string | null
                        highlightedText: string | null
                        instructions: string | null
                        linkToPage: string | null
                        overrideId: string
                      }) => (
                        <div key={symptom.id} className="bg-gray-50 p-3 rounded border">
                          <div className="font-medium text-nhs-dark-blue">
                            {symptom.name}
                          </div>
                          <div className="text-sm text-nhs-grey mb-2">
                            {symptom.ageGroup} • {symptom.briefInstruction}
                          </div>
                          <button
                            onClick={() => handleRestoreSymptom(symptom.id, surgeryGroup.surgery.id)}
                            disabled={isLoading}
                            className="px-3 py-1 bg-nhs-green text-white rounded text-sm hover:bg-green-600 transition-colors disabled:opacity-50"
                          >
                            {isLoading ? 'Restoring...' : 'Restore'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowHiddenSymptomsDialog(false)
                  setHiddenSymptoms([])
                }}
                className="nhs-button-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
