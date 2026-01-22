'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { signOut } from 'next-auth/react'
import SimpleHeader from '@/components/SimpleHeader'
import HighlightConfig from '@/components/HighlightConfig'
import HighRiskConfig from '@/components/HighRiskConfig'
import CommonReasonsConfig from '@/components/CommonReasonsConfig'
import ImageIconConfig from '@/components/ImageIconConfig'
import SymptomLibraryExplorer from '@/components/SymptomLibraryExplorer'
import ClinicalReviewPanel from '@/components/ClinicalReviewPanel'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import RichTextEditor from '@/components/rich-text/RichTextEditor'
import EngagementAnalytics from '@/components/EngagementAnalytics'
import SuggestionsAnalytics from '@/components/SuggestionsAnalytics'
import FeaturesAdmin from '@/components/FeaturesAdmin'
import SetupChecklistClient from '@/app/s/[id]/admin/setup-checklist/SetupChecklistClient'
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('library')
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
    ageGroup: 'Adult',
    briefInstruction: '',
    instructions: '',
    instructionsJson: null as any,
    instructionsHtml: '',
    highlightedText: '',
    linkToPage: '',
    variants: null as any
  })
  const [showVariantsSection, setShowVariantsSection] = useState(false)
  const [variantHeading, setVariantHeading] = useState<string>('')
  const [variants, setVariants] = useState<Array<{key: string, label: string, instructions: string}>>([])
  const [showClearAllDialog, setShowClearAllDialog] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')

  const [highlightRules, setHighlightRules] = useState<HighlightRule[]>([])
  const [effectiveSymptoms, setEffectiveSymptoms] = useState<EffectiveSymptom[]>([])
  const [baseSymptoms, setBaseSymptoms] = useState<EffectiveSymptom[]>([])
  const [showEditSymptomModal, setShowEditSymptomModal] = useState(false)
  const [editingSymptom, setEditingSymptom] = useState<EffectiveSymptom | null>(null)
  const [metrics, setMetrics] = useState<{
    pendingReviewCount: number
    suggestionsPendingCount: number
    setupChecklistOutstandingCount: number
  } | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [aiUsageData, setAiUsageData] = useState<{
    last7days: { byRoute: Array<{ route: string; calls: number; promptTokens: number; completionTokens: number; costUsd: number; costGbp: number }>; overall: { calls: number; promptTokens: number; completionTokens: number; costUsd: number; costGbp: number } }
    last30days: { byRoute: Array<{ route: string; calls: number; promptTokens: number; completionTokens: number; costUsd: number; costGbp: number }>; overall: { calls: number; promptTokens: number; completionTokens: number; costUsd: number; costGbp: number } }
  } | null>(null)
  const [aiUsageLoading, setAiUsageLoading] = useState(false)
  const [aiUsageError, setAiUsageError] = useState<string | null>(null)
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({})
  const [featureFlagsLoading, setFeatureFlagsLoading] = useState(false)
  const [setupChecklistData, setSetupChecklistData] = useState<{
    surgeryId: string
    surgeryName: string
    onboardingCompleted: boolean
    onboardingCompletedAt: Date | null
    appointmentModelConfigured: boolean
    aiCustomisationOccurred: boolean
    pendingCount: number
  } | null>(null)
  const [setupChecklistLoading, setSetupChecklistLoading] = useState(false)

  const refreshMetrics = useCallback(async () => {
    if (!selectedSurgery) return

    setMetricsLoading(true)

    try {
      const res = await fetch(`/api/admin/metrics?surgeryId=${selectedSurgery}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load metrics')
      const data = await res.json()
      setMetrics({
        pendingReviewCount: data.pendingReviewCount ?? 0,
        suggestionsPendingCount: data.suggestionsPendingCount ?? 0,
        setupChecklistOutstandingCount: data.setupChecklistOutstandingCount ?? 0,
      })
    } catch (error) {
      console.error('Error loading admin metrics:', error)
      setMetrics(null)
    } finally {
      setMetricsLoading(false)
    }
  }, [selectedSurgery])

  // Load AI usage data when tab is active
  useEffect(() => {
    if (activeTab === 'aiUsage' && session.type === 'superuser' && !aiUsageData && !aiUsageLoading) {
      setAiUsageLoading(true)
      setAiUsageError(null)
      fetch('/api/aiUsageSummary')
        .then(async (res) => {
          if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
              setAiUsageError('Superuser access required.')
              return
            }
            setAiUsageError('Usage data not available.')
            return
          }
          const data = await res.json()
          setAiUsageData(data)
        })
        .catch(() => {
          setAiUsageError('Usage data not available.')
        })
        .finally(() => {
          setAiUsageLoading(false)
        })
    }
  }, [activeTab, session.type, aiUsageData, aiUsageLoading])

  // Load feature flags for current surgery
  useEffect(() => {
    if (session.type === 'surgery' && session.surgeryId && !featureFlagsLoading) {
      setFeatureFlagsLoading(true)
      fetch(`/api/surgeryFeatures?surgeryId=${session.surgeryId}`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            const flagsMap: Record<string, boolean> = {}
            if (data.features && Array.isArray(data.features)) {
              data.features.forEach((f: { key: string; enabled: boolean }) => {
                flagsMap[f.key] = f.enabled
              })
            }
            setFeatureFlags(flagsMap)
          }
        })
        .catch(err => {
          console.error('Error loading feature flags:', err)
        })
        .finally(() => {
          setFeatureFlagsLoading(false)
        })
    }
  }, [session.type, session.surgeryId])

  // Load setup checklist data when tab is active
  useEffect(() => {
    if (activeTab === 'setup-checklist' && session.type === 'surgery' && session.surgeryId && !setupChecklistLoading && !setupChecklistData) {
      setSetupChecklistLoading(true)
      fetch(`/api/admin/setup-checklist?surgeryId=${session.surgeryId}`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json()
            setSetupChecklistData({
              surgeryId: data.surgeryId,
              surgeryName: data.surgeryName,
              onboardingCompleted: data.onboardingCompleted,
              onboardingCompletedAt: data.onboardingCompletedAt ? new Date(data.onboardingCompletedAt) : null,
              appointmentModelConfigured: data.appointmentModelConfigured,
              aiCustomisationOccurred: data.aiCustomisationOccurred,
              pendingCount: data.pendingCount,
            })
          }
        })
        .catch(err => {
          console.error('Error loading setup checklist data:', err)
        })
        .finally(() => {
          setSetupChecklistLoading(false)
        })
    }
  }, [activeTab, session.type, session.surgeryId])

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

  // Load admin metrics (pending review, suggestions, setup checklist) when surgery selection changes
  useEffect(() => {
    refreshMetrics()
  }, [refreshMetrics])

  // Refresh tab badges after create/approve/delete.
  useEffect(() => {
    const handler = () => {
      refreshMetrics()
    }
    window.addEventListener('signposting:admin-metrics-changed', handler)
    return () => window.removeEventListener('signposting:admin-metrics-changed', handler)
  }, [refreshMetrics])

  // Load base symptoms for Current Base Symptoms section
  const loadBaseSymptoms = async () => {
    try {
      const response = await fetch('/api/admin/symptoms', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        setBaseSymptoms(data.symptoms || [])
      } else {
        console.error('Failed to load base symptoms')
      }
    } catch (error) {
      console.error('Error loading base symptoms:', error)
    }
  }

  // Load base symptoms on component mount
  useEffect(() => {
    loadBaseSymptoms()
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

  // Initialize active tab from URL params
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    const validTabs = ['library', 'clinical-review', 'data', 'highlights', 'highrisk', 'engagement', 'suggestions', 'features', 'users', 'system', 'aiUsage', 'setup-checklist']
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

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

  const handleEditSymptom = (symptom: EffectiveSymptom) => {
    setEditingSymptom(symptom)
    
    // Parse instructionsJson if it exists, otherwise use instructions as fallback
    let instructionsJson = null
    try {
      if (symptom.instructionsJson) {
        instructionsJson = typeof symptom.instructionsJson === 'string' 
          ? JSON.parse(symptom.instructionsJson) 
          : symptom.instructionsJson
      }
    } catch (error) {
      console.warn('Failed to parse instructionsJson:', error)
    }
    
    setNewSymptom({
      name: symptom.name,
      ageGroup: symptom.ageGroup,
      briefInstruction: symptom.briefInstruction || '',
      instructions: symptom.instructions || '',
      instructionsJson: instructionsJson,
      instructionsHtml: symptom.instructionsHtml || '',
      highlightedText: symptom.highlightedText || '',
      linkToPage: symptom.linkToPage || '',
      variants: (symptom as any).variants ?? null
    })
    try {
      const v = (symptom as any).variants
      setVariantHeading(v?.heading || '')
      setVariants(Array.isArray(v?.ageGroups) ? v.ageGroups.map((g: any) => ({
        key: g.key || '',
        label: g.label || '',
        instructions: g.instructions || ''
      })) : [])
      // Preserve position in newSymptom.variants so the select reflects existing state
      if (v && v.position) {
        setNewSymptom(prev => ({ ...prev, variants: { ...(prev.variants || {}), position: v.position } as any }))
      }
    } catch {}
    setShowEditSymptomModal(true)
  }

  const handleUpdateSymptom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSymptom) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/symptoms/${editingSymptom.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'base',
          name: newSymptom.name,
          ageGroup: newSymptom.ageGroup,
          briefInstruction: newSymptom.briefInstruction,
          instructions: newSymptom.instructions,
          instructionsJson: newSymptom.instructionsJson,
          instructionsHtml: newSymptom.instructionsHtml,
          highlightedText: newSymptom.highlightedText,
          linkToPage: newSymptom.linkToPage,
          variants: variants.length > 0 ? { heading: (variantHeading || undefined), ageGroups: variants } : null
        })
      })

      const result = await response.json()
      
      if (response.ok) {
        toast.success('Symptom updated successfully!')
        setShowEditSymptomModal(false)
        setEditingSymptom(null)
        // Reload base symptoms to show updated data
        loadBaseSymptoms()
      } else {
        toast.error(result.error || 'Failed to update symptom')
      }
    } catch (error) {
      console.error('Update symptom error:', error)
      toast.error('An error occurred')
    } finally {
      setIsLoading(false)
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
          linkToPage: '',
          variants: null
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
    if (!newSymptom.name) {
      toast.error('Please enter a symptom name')
      return
    }

    setIsLoading(true)
    try {
      const payload = {
        ...newSymptom,
        variants: variants.length > 0 ? { heading: (variantHeading || undefined), position: ((newSymptom.variants as any)?.position || 'before'), ageGroups: variants } : null
      }
      
      const response = await fetch('/api/admin/symptoms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Symptom added successfully')
        setNewSymptom({
          name: '',
          ageGroup: 'Adult',
          briefInstruction: '',
          instructions: '',
          instructionsJson: null,
          instructionsHtml: '',
          highlightedText: '',
          linkToPage: '',
          variants: null
        })
        setVariants([])
        setVariantHeading('')
        setShowVariantsSection(false)
        setShowAddSymptomForm(false)
        // Reload symptoms to show the new one
        loadEffectiveSymptoms()
        loadBaseSymptoms()
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

  const handleClearAllData = async () => {
    if (clearConfirmText !== 'DELETE ALL DATA') {
      toast.error('Please type "DELETE ALL DATA" exactly to confirm')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/clear-all-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmText: clearConfirmText })
      })

      if (response.ok) {
        toast.success('All data cleared successfully')
        setShowClearAllDialog(false)
        setClearConfirmText('')
        // Refresh the page to show empty state
        window.location.reload()
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Clear all data failed:', errorData)
        toast.error(`Failed to clear data: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error clearing all data:', error)
      toast.error('Failed to clear all data')
    } finally {
      setIsLoading(false)
    }
  }

  const setupChecklistBadge = metrics?.setupChecklistOutstandingCount && metrics.setupChecklistOutstandingCount > 0
    ? metrics.setupChecklistOutstandingCount
    : undefined
  const clinicalReviewBadge = metrics?.pendingReviewCount && metrics.pendingReviewCount > 0
    ? metrics.pendingReviewCount
    : undefined
  const suggestionsBadge = metrics?.suggestionsPendingCount && metrics.suggestionsPendingCount > 0
    ? metrics.suggestionsPendingCount
    : undefined

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
                  // Symptom Library first; visible to superusers and surgery admins
                  { id: 'library', label: 'Symptom Library' },
                  // Clinical Review: visible to superusers and surgery admins
                  ...((session.type === 'superuser' || session.type === 'surgery')
                    ? [{ id: 'clinical-review', label: 'Clinical Review', badge: clinicalReviewBadge }]
                    : []),
                  // Data Management is superuser-only
                  ...(session.type === 'superuser' ? [{ id: 'data', label: 'Data Management' }] : []),
                  { id: 'highlights', label: 'Highlight Config' },
                  { id: 'highrisk', label: 'High-Risk Buttons' },
                  ...((session.type === 'superuser' || session.type === 'surgery') ? [{ id: 'front-page', label: 'Quick Access' }] : []),
                  { id: 'engagement', label: 'Engagement' },
                  { id: 'suggestions', label: 'Suggestions', badge: suggestionsBadge },
                  // Features: visible to SUPERUSER and PRACTICE_ADMIN
                  ...((session.type === 'superuser' || session.type === 'surgery') ? [{ id: 'features', label: 'Features' }] : []),
                  // Setup Checklist: only visible if ai_surgery_customisation feature flag is enabled
                  ...(session.type === 'surgery' && featureFlags.ai_surgery_customisation === true
                    ? [{ id: 'setup-checklist', label: 'Setup Checklist', badge: setupChecklistBadge }]
                    : []),
                  ...(session.type === 'surgery' ? [{ id: 'users', label: 'User Management' }] : []),
                  ...(session.type === 'superuser'
                    ? [
                        { id: 'system', label: 'System Management' },
                        { id: 'aiUsage', label: 'AI usage / cost' },
                      ]
                    : []),
                ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    router.push(`/admin?tab=${tab.id}`, { scroll: false })
                  }}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-nhs-blue text-nhs-blue'
                      : 'border-transparent text-nhs-grey hover:text-nhs-blue hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Data Management Tab - Superuser only */}
            {activeTab === 'data' && session.type === 'superuser' && (
              <div className="space-y-6">
                {/* Superuser area: day-to-day controls moved to Symptom Library */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold text-nhs-dark-blue mb-2">Superuser Data Management</h2>
                  <p className="text-sm text-nhs-grey">
                    Day-to-day symptom enable/disable and revert-to-base are now managed in the <strong>Symptom Library</strong>.
                    This area is for global tools only (imports, audits, bulk ops).
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
                  {session.type === 'superuser' ? (
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
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
                      <div className="text-center text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <p className="text-lg font-medium text-gray-600 mb-2">Excel Upload Restricted</p>
                        <p className="text-sm text-gray-500">
                          This feature is currently restricted to authorized administrators only.
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          Contact the system administrator if you need to upload Excel files.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-nhs-dark-blue mb-3">
                    Current Base Symptoms ({baseSymptoms.length})
                  </h3>
                  <div className="bg-nhs-light-grey rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {baseSymptoms.map((symptom) => (
                        <div 
                          key={symptom.id} 
                          className="bg-white p-3 rounded border cursor-pointer hover:border-nhs-blue hover:shadow-md transition-all"
                          onClick={() => handleEditSymptom(symptom)}
                          title="Click to edit this symptom"
                        >
                          <div className="font-medium text-nhs-dark-blue">
                            {symptom.name}
                          </div>
                            <div 
                              className="text-sm text-nhs-grey"
                              dangerouslySetInnerHTML={{ 
                                __html: `${symptom.ageGroup} • ${highlightText(symptom.briefInstruction || '')}` 
                              }}
                            />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* Highlight Config Tab */}
            {activeTab === 'highlights' && (
              <div className="space-y-6">
                <HighlightConfig surgeryId={selectedSurgery} isSuperuser={session?.type === 'superuser'} />
                {/* Image Icons - visible to superusers and admins */}
                {(session?.type === 'superuser' || session?.type === 'surgery') && (
                  <ImageIconConfig 
                    isSuperuser={session?.type === 'superuser'} 
                    isAdmin={session?.type === 'surgery'} 
                  />
                )}
              </div>
            )}

            {/* High-Risk Buttons Tab */}
            {activeTab === 'highrisk' && (
              <div className="space-y-6">
                <HighRiskConfig 
                  surgeryId={selectedSurgery} 
                  surgeries={surgeries.filter(s => s.slug !== null).map(s => ({ id: s.id, slug: s.slug!, name: s.name }))}
                  symptoms={effectiveSymptoms
                    .filter(s => !!s.id && !!s.slug)
                    .map(s => ({ id: s.id, slug: s.slug as string, name: s.name }))
                    .sort((a, b) => a.name.localeCompare(b.name))}
                  session={session} 
                />
              </div>
            )}

            {/* Quick Access Tab (route remains "front-page") */}
            {activeTab === 'front-page' && (session.type === 'superuser' || session.type === 'surgery') && (
              <div className="space-y-6">
                <CommonReasonsConfig 
                  surgeryId={selectedSurgery} 
                  symptoms={effectiveSymptoms}
                  initialConfig={undefined} // Will be fetched client-side
                />
              </div>
            )}

            {/* Engagement Tab */}
            {activeTab === 'engagement' && (
              <EngagementAnalytics 
                session={session} 
                surgeries={session.type === 'superuser' ? surgeries : undefined}
              />
            )}

            {/* Suggestions Tab */}
            {activeTab === 'suggestions' && (
              <SuggestionsAnalytics session={session} />
            )}

            {/* Features Tab */}
            {activeTab === 'features' && (session.type === 'superuser' || session.type === 'surgery') && (
              <FeaturesAdmin
                currentUser={{
                  id: session.id,
                  email: session.email,
                  globalRole: session.type === 'superuser' ? 'SUPERUSER' : 'USER',
                  surgeryId: session.surgeryId
                }}
                selectedSurgeryId={selectedSurgery || session.surgeryId || null}
              />
            )}

            {/* Setup Checklist Tab - Only for Surgery Admins with feature flag enabled */}
            {activeTab === 'setup-checklist' && session.type === 'surgery' && featureFlags.ai_surgery_customisation === true && (
              <div>
                {setupChecklistLoading ? (
                  <div className="text-center py-8">
                    <p className="text-nhs-grey">Loading setup checklist...</p>
                  </div>
                ) : setupChecklistData ? (
                  <SetupChecklistClient
                    surgeryId={setupChecklistData.surgeryId}
                    surgeryName={setupChecklistData.surgeryName}
                    onboardingCompleted={setupChecklistData.onboardingCompleted}
                    onboardingCompletedAt={setupChecklistData.onboardingCompletedAt}
                    appointmentModelConfigured={setupChecklistData.appointmentModelConfigured}
                    aiCustomisationOccurred={setupChecklistData.aiCustomisationOccurred}
                    pendingCount={setupChecklistData.pendingCount}
                  />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-nhs-grey">Failed to load setup checklist data.</p>
                  </div>
                )}
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
                  
                  <div className="flex gap-4 flex-wrap">
                    <a
                      href={`/s/${session.surgeryId}/admin/users`}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Manage Users
                    </a>
                  </div>
                  </div>

                {/* Optional: Cross-link to Setup Checklist tab if feature flag enabled */}
                {featureFlags.ai_surgery_customisation === true && (() => {
                  const currentSurgery = surgeries.find(s => s.id === session.surgeryId)
                  const onboardingCompleted = currentSurgery?.onboardingProfile?.completed ?? false
                  const completedAt = currentSurgery?.onboardingProfile?.completedAt
                  
                  if (onboardingCompleted && completedAt) {
                    return (
                      <div className="mt-6 text-sm text-gray-600">
                        Onboarding: Completed on {new Date(completedAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}.{' '}
                        <button
                          onClick={() => {
                            setActiveTab('setup-checklist')
                            router.push('/admin?tab=setup-checklist', { scroll: false })
                          }}
                          className="text-nhs-blue hover:underline"
                        >
                          View in Setup Checklist tab
                        </button>
                      </div>
                    )
                  }
                  return null
                })()}
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

            {/* Symptom Library Tab */}
            {activeTab === 'library' && (
              <div>
                <h2 className="text-xl font-semibold text-nhs-dark-blue mb-4">
                  Symptom Library
                </h2>
                <p className="text-nhs-grey mb-6">
                  Manage which symptoms are available and how they’re configured for each surgery.
                </p>
                {(() => {
                  const isSuper = session?.type === 'superuser'
                  const surgeryIdForLibrary = isSuper ? (selectedSurgery || null) : (session?.surgeryId || null)
                  return (
                    <SymptomLibraryExplorer surgeryId={surgeryIdForLibrary} />
                  )
                })()}
              </div>
            )}

            {/* Clinical Review Tab */}
            {activeTab === 'clinical-review' && (session.type === 'superuser' || session.type === 'surgery') && (
              <div>
                <h2 className="text-xl font-semibold text-nhs-dark-blue mb-4">
                  Clinical Review
                </h2>
                <p className="text-nhs-grey mb-6">
                  Review symptoms for clinical approval.
                </p>
                {(() => {
                  const isSuper = session?.type === 'superuser'
                  const surgeryIdForReview = isSuper ? (selectedSurgery || null) : (session?.surgeryId || null)
                  return (
                    <ClinicalReviewPanel 
                      selectedSurgery={surgeryIdForReview}
                      isSuperuser={isSuper}
                      adminSurgeryId={session?.surgeryId || null}
                    />
                  )
                })()}
              </div>
            )}

            {/* AI Usage / Cost Tab - Only for Superusers */}
            {activeTab === 'aiUsage' && session.type === 'superuser' && (
              <div>
                <h2 className="text-xl font-semibold text-nhs-dark-blue mb-4">
                  AI Usage / Cost Dashboard
                </h2>
                <p className="text-nhs-grey mb-6">
                  Monitor AI usage and estimated costs across the system.
                </p>

                {aiUsageLoading && (
                  <div className="text-center py-8">
                    <p className="text-nhs-grey">Loading usage data...</p>
                  </div>
                )}

                {aiUsageError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-800">{aiUsageError}</p>
                  </div>
                )}

                {!aiUsageLoading && !aiUsageError && aiUsageData && (
                  <div className="space-y-6">
                    {/* Last 7 Days */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="text-lg font-semibold text-nhs-dark-blue mb-4">
                        Last 7 days
                      </h3>
                      <div className="mb-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-nhs-grey">Total Calls</p>
                            <p className="text-xl font-semibold">{aiUsageData.last7days.overall.calls}</p>
                          </div>
                          <div>
                            <p className="text-sm text-nhs-grey">Estimated Cost</p>
                            <p className="text-xl font-semibold">£{aiUsageData.last7days.overall.costGbp.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                      {aiUsageData.last7days.byRoute.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Route
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Calls
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Tokens In
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Tokens Out
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Estimated Cost
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {aiUsageData.last7days.byRoute.map((routeData) => (
                                <tr key={routeData.route}>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {routeData.route === 'improveInstruction' ? 'Improve wording' : routeData.route === 'explainInstruction' ? 'Explain rule' : routeData.route}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {routeData.calls}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {routeData.promptTokens.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {routeData.completionTokens.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    £{routeData.costGbp.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-nhs-grey text-sm">No usage data for this period.</p>
                      )}
                    </div>

                    {/* Last 30 Days */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h3 className="text-lg font-semibold text-nhs-dark-blue mb-4">
                        Last 30 days
                      </h3>
                      <div className="mb-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-nhs-grey">Total Calls</p>
                            <p className="text-xl font-semibold">{aiUsageData.last30days.overall.calls}</p>
                          </div>
                          <div>
                            <p className="text-sm text-nhs-grey">Estimated Cost</p>
                            <p className="text-xl font-semibold">£{aiUsageData.last30days.overall.costGbp.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                      {aiUsageData.last30days.byRoute.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Route
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Calls
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Tokens In
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Tokens Out
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Estimated Cost
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {aiUsageData.last30days.byRoute.map((routeData) => (
                                <tr key={routeData.route}>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {routeData.route === 'improveInstruction' ? 'Improve wording' : routeData.route === 'explainInstruction' ? 'Explain rule' : routeData.route}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {routeData.calls}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {routeData.promptTokens.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {routeData.completionTokens.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    £{routeData.costGbp.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-nhs-grey text-sm">No usage data for this period.</p>
                      )}
                    </div>
                  </div>
                )}
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
              <div className="grid grid-cols-1 gap-4">
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
                <RichTextEditor
                  docId={`admin:symptom:new:instructions`}
                  value={newSymptom.instructionsHtml || newSymptom.instructions || ''}
                  onChange={(html) => {
                    const sanitizedHtml = sanitizeHtml(html)
                    setNewSymptom(prev => ({ 
                      ...prev, 
                      instructionsHtml: sanitizedHtml,
                      instructions: sanitizedHtml, // Keep legacy field for compatibility
                      instructionsJson: null
                    }))
                  }}
                  placeholder="Enter detailed instructions with formatting..."
                  height={200}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use the toolbar to format text, add NHS badges, create lists, and more.
                </p>
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

              {/* Variants Section (Superusers Only) */}
              {session?.type === 'superuser' && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-nhs-dark-blue">Variants (Optional)</h3>
                    <button
                      type="button"
                      onClick={() => setShowVariantsSection(!showVariantsSection)}
                      className="text-sm text-nhs-blue hover:text-nhs-dark-blue"
                    >
                      {showVariantsSection ? 'Hide' : 'Add Variants'}
                    </button>
                  </div>
                  
                  {showVariantsSection && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-nhs-grey mb-1">
                          Variant Heading (optional)
                        </label>
                        <input
                          type="text"
                          value={variantHeading}
                          onChange={(e) => setVariantHeading(e.target.value)}
                          className="w-full nhs-input"
                          placeholder="e.g., Choose Age Group"
                        />
                        <p className="text-xs text-gray-500 mt-1">Leave blank to hide the heading on the instructions page.</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-nhs-grey mb-1">
                          Variant Position
                        </label>
                        <select
                          value={(newSymptom.variants as any)?.position || 'before'}
                          onChange={(e) => {
                            const pos = e.target.value
                            setNewSymptom(prev => ({ ...prev, variants: { ...(prev.variants || {}), position: pos } as any }))
                          }}
                          className="w-full nhs-input"
                        >
                          <option value="before">Before instructions</option>
                          <option value="after">After instructions</option>
                        </select>
                      </div>
                      {variants.map((variant, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            <input
                              type="text"
                              value={variant.label}
                              onChange={(e) => {
                                const updated = [...variants]
                                updated[index].label = e.target.value
                                updated[index].key = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                                setVariants(updated)
                              }}
                              placeholder="Label (e.g., Under 5)"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                            <input
                              type="text"
                              value={variant.key}
                              onChange={(e) => {
                                const updated = [...variants]
                                updated[index].key = e.target.value
                                setVariants(updated)
                              }}
                              placeholder="Key"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div className="mt-2">
                            <label className="block text-sm font-medium text-nhs-grey mb-1">
                              Variant Instructions
                            </label>
                            <RichTextEditor
                              docId={`admin:symptom:new:variant:${index}`}
                              value={variant.instructions || ''}
                              onChange={(html) => {
                                const sanitizedHtml = sanitizeHtml(html)
                                const updated = [...variants]
                                updated[index].instructions = sanitizedHtml
                                setVariants(updated)
                              }}
                              placeholder="Enter detailed instructions for this variant..."
                              height={180}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setVariants(variants.filter((_, i) => i !== index))}
                            className="mt-2 text-sm text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      
                      <button
                        type="button"
                        onClick={() => setVariants([...variants, { key: '', label: '', instructions: '' }])}
                        className="text-sm text-nhs-blue hover:text-nhs-dark-blue"
                      >
                        + Add Variant
                      </button>
                    </div>
                  )}
                </div>
              )}

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

      {/* Clear All Data Warning Modal */}
      {showClearAllDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xl">⚠️</span>
                </div>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-red-600">
                  Clear All Data
                </h3>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-4">
                <strong>WARNING:</strong> This action will permanently delete ALL data from the system:
              </p>
              <ul className="text-sm text-gray-600 list-disc list-inside mb-4 space-y-1">
                <li>All base symptoms</li>
                <li>All custom symptoms</li>
                <li>All surgery overrides</li>
                <li>All highlight rules</li>
                <li>All high-risk button configurations</li>
              </ul>
              <p className="text-sm text-red-600 font-semibold">
                This action cannot be undone!
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To confirm, type: <code className="bg-gray-100 px-2 py-1 rounded">DELETE ALL DATA</code>
              </label>
              <input
                type="text"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                placeholder="Type confirmation text here..."
                className="w-full nhs-input border-red-300 focus:border-red-500 focus:ring-red-500"
                autoComplete="off"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleClearAllData}
                disabled={clearConfirmText !== 'DELETE ALL DATA' || isLoading}
                className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {isLoading ? 'Clearing...' : '🗑️ Clear All Data'}
              </button>
              <button
                onClick={() => {
                  setShowClearAllDialog(false)
                  setClearConfirmText('')
                }}
                className="nhs-button-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Symptom Modal */}
      {showEditSymptomModal && editingSymptom && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Base Symptom</h3>
              <form onSubmit={handleUpdateSymptom}>
                <div className="grid grid-cols-1 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newSymptom.name}
                      onChange={(e) => setNewSymptom(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-nhs-blue focus:border-nhs-blue"
                    />
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Age Group *
                  </label>
                  <select
                    required
                    value={newSymptom.ageGroup}
                    onChange={(e) => setNewSymptom(prev => ({ ...prev, ageGroup: e.target.value as 'U5' | 'O5' | 'Adult' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-nhs-blue focus:border-nhs-blue"
                  >
                    <option value="U5">Under 5</option>
                    <option value="O5">Over 5</option>
                    <option value="Adult">Adult</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brief Instruction
                  </label>
                  <textarea
                    value={newSymptom.briefInstruction}
                    onChange={(e) => setNewSymptom(prev => ({ ...prev, briefInstruction: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-nhs-blue focus:border-nhs-blue"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Instructions
                  </label>
                  <RichTextEditor
                    docId={`admin:symptom:edit:${editingSymptom?.id || 'none'}:instructions`}
                    value={newSymptom.instructionsHtml || newSymptom.instructions || ''}
                    onChange={(html) => {
                      const sanitizedHtml = sanitizeHtml(html)
                      setNewSymptom(prev => ({ 
                        ...prev, 
                        instructionsHtml: sanitizedHtml,
                        instructions: sanitizedHtml, // Keep legacy field for compatibility
                        instructionsJson: null
                      }))
                    }}
                    placeholder="Enter detailed instructions with formatting..."
                    height={250}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use the toolbar to format text, add NHS badges, create lists, and more.
                  </p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Highlighted Text
                  </label>
                  <textarea
                    value={newSymptom.highlightedText}
                    onChange={(e) => setNewSymptom(prev => ({ ...prev, highlightedText: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-nhs-blue focus:border-nhs-blue"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link to Page
                  </label>
                  <input
                    type="url"
                    value={newSymptom.linkToPage}
                    onChange={(e) => setNewSymptom(prev => ({ ...prev, linkToPage: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-nhs-blue focus:border-nhs-blue"
                  />
                </div>

                {/* Variants Section (Superusers Only) */}
                {session?.type === 'superuser' && (
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-nhs-dark-blue">Variants (Optional)</h4>
                      <button
                        type="button"
                        onClick={() => setShowVariantsSection(!showVariantsSection)}
                        className="text-sm text-nhs-blue hover:text-nhs-dark-blue"
                      >
                        {showVariantsSection ? 'Hide' : 'Add Variants'}
                      </button>
                    </div>

                    {showVariantsSection && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-nhs-grey mb-1">
                            Variant Heading (optional)
                          </label>
                          <input
                            type="text"
                            value={variantHeading}
                            onChange={(e) => setVariantHeading(e.target.value)}
                            className="w-full nhs-input"
                            placeholder="e.g., Choose Age Group"
                          />
                          <p className="text-xs text-gray-500 mt-1">Leave blank to hide the heading on the instructions page.</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-nhs-grey mb-1">
                            Variant Position
                          </label>
                          <select
                            value={(newSymptom.variants as any)?.position || 'before'}
                            onChange={(e) => {
                              const pos = e.target.value
                              setNewSymptom(prev => ({ ...prev, variants: { ...(prev.variants || {}), position: pos } as any }))
                            }}
                            className="w-full nhs-input"
                          >
                            <option value="before">Before instructions</option>
                            <option value="after">After instructions</option>
                          </select>
                        </div>

                        {variants.map((variant, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                            <div className="grid grid-cols-2 gap-3 mb-2">
                              <input
                                type="text"
                                value={variant.label}
                                onChange={(e) => {
                                  const updated = [...variants]
                                  updated[index].label = e.target.value
                                  updated[index].key = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                                  setVariants(updated)
                                }}
                                placeholder="Label (e.g., Under 5)"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              />
                              <input
                                type="text"
                                value={variant.key}
                                onChange={(e) => {
                                  const updated = [...variants]
                                  updated[index].key = e.target.value
                                  setVariants(updated)
                                }}
                                placeholder="Key"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              />
                            </div>
                            <textarea
                              value={variant.instructions}
                              onChange={(e) => {
                                const updated = [...variants]
                                updated[index].instructions = e.target.value
                                setVariants(updated)
                              }}
                              placeholder="Instructions for this variant"
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                            <button
                              type="button"
                              onClick={() => setVariants(variants.filter((_, i) => i !== index))}
                              className="mt-2 text-sm text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => setVariants([...variants, { key: '', label: '', instructions: '' }])}
                          className="text-sm text-nhs-blue hover:text-nhs-dark-blue"
                        >
                          + Add Variant
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditSymptomModal(false)
                      setEditingSymptom(null)
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-nhs-blue text-white rounded-lg hover:bg-nhs-dark-blue disabled:opacity-50"
                  >
                    {isLoading ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
