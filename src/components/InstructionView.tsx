'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import SuggestFeatureDialog from './SuggestFeatureDialog'
import { applyHighlightRules, HighlightRule } from '@/lib/highlighting'
import { sanitizeAndFormatSymptomContent, sanitizeSymptomHtml } from '@/lib/sanitizeHtml'
import RichTextEditor from './rich-text/RichTextEditor'
import VariantGroupsEditor from './VariantGroupsEditor'
import RelatedSymptomsEditor from './RelatedSymptomsEditor'
import { useSurgery } from '@/context/SurgeryContext'
import { useCardStyle } from '@/context/CardStyleContext'
import { toast } from 'react-hot-toast'
import { ageGroupBadgeClasses, formatAgeGroupLabel, formatAgeGroupDescription } from '@/lib/ageGroups'
import { Button, Dialog } from '@/components/ui'

interface InstructionViewProps {
  symptom: EffectiveSymptom
  surgeryId?: string
  // Per-surgery 'hide_age_bands' feature flag: no age badge, all-ages editing
  // guidance, and all-ages AI question prompts. Resolved server-side by the
  // page (never via /api/my/features, which over-reports for superusers).
  hideAgeBands?: boolean
}

export default function InstructionView({ symptom, surgeryId, hideAgeBands = false }: InstructionViewProps) {
  const [showSuggestionModal, setShowSuggestionModal] = useState(false)
  const [highlightRules, setHighlightRules] = useState<HighlightRule[]>([])
  // Name of the related-symptom link currently being resolved (null = none).
  const [loadingLinkedSymptomName, setLoadingLinkedSymptomName] = useState<string | null>(null)
  const [linkedSymptomError, setLinkedSymptomError] = useState<string | null>(null)
  const [isEditingInstructions, setIsEditingInstructions] = useState(false)
  const [editedInstructions, setEditedInstructions] = useState('')
  const [isSavingInstructions, setIsSavingInstructions] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isEditingAll, setIsEditingAll] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [editedBriefInstruction, setEditedBriefInstruction] = useState('')
  const [editedHighlightedText, setEditedHighlightedText] = useState('')
  const [editedLinkToPages, setEditedLinkToPages] = useState<string[]>([])
  // Snapshot at edit-open; links are only sent on save when actually changed,
  // so an untouched override keeps inheriting the base symptom's links.
  const [originalLinkToPages, setOriginalLinkToPages] = useState<string[]>([])
  // Tri-state override tracking. Captured on edit-open, used on save to decide
  // per field whether to send the field at all (unchanged), send a string
  // (explicit override, including "" = blank), or send null (reset to default).
  const [originalBriefInstruction, setOriginalBriefInstruction] = useState('')
  const [originalHighlightedText, setOriginalHighlightedText] = useState('')
  const [originalInstructions, setOriginalInstructions] = useState('')
  const [briefInstructionReset, setBriefInstructionReset] = useState(false)
  const [highlightedTextReset, setHighlightedTextReset] = useState(false)
  const [instructionsReset, setInstructionsReset] = useState(false)
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [isHidingSymptom, setIsHidingSymptom] = useState(false)
  const [hideError, setHideError] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  // Superuser "push to base" (update the shared library from this practice's
  // version, or promote a practice-created symptom into it).
  const [showPushToBaseDialog, setShowPushToBaseDialog] = useState(false)
  const [isPushingToBase, setIsPushingToBase] = useState(false)
  const [isDeletingSymptom, setIsDeletingSymptom] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [selectedVariantKey, setSelectedVariantKey] = useState<string | null>(null)
  // Superuser variant editor state. Variants live on the BaseSymptom row only,
  // so this state always describes the base symptom's variants, even when the
  // page is showing a surgery's override.
  const [enableVariantsEdit, setEnableVariantsEdit] = useState<boolean>(false)
  const [editVariantHeading, setEditVariantHeading] = useState<string>('')
  const [editVariantPosition, setEditVariantPosition] = useState<'before' | 'after'>('before')
  const [editVariantGroups, setEditVariantGroups] = useState<Array<{ key: string; label: string; instructions: string }>>([])
  // Snapshot of the variants as prefilled, for change detection on save.
  // null = variant editing never initialized this session (never save variants then).
  const [originalVariantsJson, setOriginalVariantsJson] = useState<string | null>(null)
  // Practice-level variant override state (stored on the surgery's override row).
  // 'inherit' = use the shared base variants, 'custom' = replace for this
  // practice, 'hidden' = show no variants at this practice.
  const [surgeryVariantMode, setSurgeryVariantMode] = useState<'inherit' | 'custom' | 'hidden'>('inherit')
  const [surgeryVariantHeading, setSurgeryVariantHeading] = useState<string>('')
  const [surgeryVariantPosition, setSurgeryVariantPosition] = useState<'before' | 'after'>('before')
  const [surgeryVariantGroups, setSurgeryVariantGroups] = useState<Array<{ key: string; label: string; instructions: string }>>([])
  const [originalSurgeryVariantsJson, setOriginalSurgeryVariantsJson] = useState<string | null>(null)
  // Image icon state
  const [enableImageIcons, setEnableImageIcons] = useState<boolean>(true)
  const [imageIcon, setImageIcon] = useState<{ imageUrl: string; instructionSize: string } | null>(null)
  // AI suggestion state
  const [showAIModal, setShowAIModal] = useState(false)
  const [loadingAI, setLoadingAI] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [aiBrief, setAiBrief] = useState<string | null>(null)
  const [aiModel, setAiModel] = useState<string | null>(null)
  // AI explanation state (kept for API but UI hidden)
  const [showExplanationModal, setShowExplanationModal] = useState(false)
  const [loadingExplanation, setLoadingExplanation] = useState(false)
  const [explanationHtml, setExplanationHtml] = useState<string | null>(null)
  const [explanationModel, setExplanationModel] = useState<string | null>(null)
  // AI question prompts state
  const [showQuestionsPanel, setShowQuestionsPanel] = useState(false)
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [questionPrompts, setQuestionPrompts] = useState<{
    symptom: string
    ageGroup: string
    groups: Array<{ label: string; questions: string[] }>
  } | null>(null)
  const [questionsError, setQuestionsError] = useState<string | null>(null)
  const questionsPanelRef = useRef<HTMLDivElement>(null)
  // Feature flags for AI features
  const [canUseAiInstructions, setCanUseAiInstructions] = useState(false)
  const [canUseAiTraining, setCanUseAiTraining] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromParam = searchParams.get('from')
  const { data: session } = useSession()
  const { currentSurgeryId } = useSurgery()
  const { cardStyle } = useCardStyle()
  const isBlueCardAppearance = cardStyle === 'powerappsBlue'
  const showBlueHeader = isBlueCardAppearance && !isEditingAll

  // Related-symptom links, falling back to the legacy single-link field for
  // payloads that predate linkToPages.
  const displayLinkToPages = symptom.linkToPages ?? (symptom.linkToPage ? [symptom.linkToPage] : [])

  // Check if user is superuser
  const isSuperuser = session?.user && (session.user as any).globalRole === 'SUPERUSER'
  
  // Check if user is practice admin for this surgery
  const isPracticeAdmin = session?.user && surgeryId && 
    (session.user as any).memberships?.some((m: any) => 
      m.surgeryId === surgeryId && m.role === 'ADMIN'
    )
  
  // Can edit if superuser or practice admin
  const canEditInstructions = isSuperuser || isPracticeAdmin

  // Inline-image upload scope must mirror handleSaveAll's target: saves that
  // land on an override/custom row are surgery-scoped, while a superuser
  // saving straight to the base symptom uploads a global image that every
  // surgery can view (a surgery-scoped image referenced from base content
  // would 404 for other surgeries).
  const savesToBaseSymptom = symptom.source === 'base' && !isPracticeAdmin
  const symptomImageUpload = savesToBaseSymptom || !surgeryId
    ? { kind: 'symptom' as const }
    : { kind: 'symptom' as const, surgeryId }
  // The shared-variants editor always writes to the base symptom (custom
  // symptoms aside), so its uploads are global unless the symptom is
  // practice-owned.
  const variantImageUpload = surgeryId && symptom.source === 'custom'
    ? { kind: 'symptom' as const, surgeryId }
    : { kind: 'symptom' as const }
  const canApplyAiChanges = canEditInstructions

  // Tri-state "Reset to default" affordance only makes sense when the save
  // will land in a SurgerySymptomOverride row (the read path then falls back
  // to BaseSymptom on null). Editing base or custom directly has no default.
  const isOverrideContext = symptom.source === 'override' || (isPracticeAdmin && symptom.source === 'base')

  // Variants are stored on the BaseSymptom row only; overrides inherit them
  // (and the effective symptom id for an override IS the base id). Custom
  // symptoms have no base backing, so they can never carry variants.
  const baseBackedSymptomId =
    symptom.source === 'base'
      ? symptom.id
      : symptom.source === 'override'
        ? ((symptom as any).baseSymptomId ?? symptom.id)
        : null
  // Where the primary variants panel saves to: the base symptom for
  // base-backed symptoms (superuser-only, shared across practices), or the
  // custom symptom itself for practice-owned symptoms (practice admins too).
  const isCustomSymptom = symptom.source === 'custom'
  const variantTargetId = baseBackedSymptomId ?? (isCustomSymptom ? symptom.id : null)
  const canEditVariants = isCustomSymptom
    ? !!surgeryId && (!!isSuperuser || !!isPracticeAdmin)
    : !!isSuperuser && !!baseBackedSymptomId

  // Practice-level variant overrides only apply to base-backed symptoms —
  // custom symptoms already belong to a single practice.
  const canEditSurgeryVariants = !!surgeryId && !!baseBackedSymptomId && (!!isSuperuser || !!isPracticeAdmin)

  // The variants the primary panel edits: the base symptom's shared variants
  // for base-backed symptoms (the effective `variants` may already be the
  // surgery's own override value), or the custom symptom's own.
  const rawBaseVariants: any =
    symptom.source === 'override' ? ((symptom as any).baseVariants ?? null) : (symptom as any).variants

  // Parse variant data and determine active variant
  const variants = symptom.variants as any
  const hasVariants = variants?.ageGroups && Array.isArray(variants.ageGroups) && variants.ageGroups.length > 0
  const activeVariant = hasVariants && selectedVariantKey ? variants.ageGroups.find((v: any) => v.key === selectedVariantKey) : null
  const originalText = (symptom.instructionsHtml || symptom.instructions || '')
  const displayText = activeVariant ? activeVariant.instructions : originalText
  const activeVariantLabel = activeVariant ? activeVariant.label : null

  // Load highlight rules from API
  useEffect(() => {
    const loadHighlightRules = async () => {
      try {
        // Build URL with surgeryId parameter if available
        let url = '/api/highlights'
        if (surgeryId) {
          url += `?surgeryId=${encodeURIComponent(surgeryId)}`
        }
        
        // Always fetch fresh rules (mutations revalidate server caches too).
        const response = await fetch(url, { cache: 'no-store' })
        if (response.ok) {
          const json = await response.json()
          const { highlights, enableImageIcons: imageIconsEnabled } = json
          setHighlightRules(Array.isArray(highlights) ? highlights : [])
          setEnableImageIcons(imageIconsEnabled ?? true)
          
          // Load image icon if enabled
          if (imageIconsEnabled && symptom.briefInstruction) {
            const iconResponse = await fetch(`/api/image-icons?phrase=${encodeURIComponent(symptom.briefInstruction)}`)
            if (iconResponse.ok) {
              const iconData = await iconResponse.json()
              if (iconData && iconData.imageUrl) {
                setImageIcon({ 
                  imageUrl: iconData.imageUrl, 
                  instructionSize: iconData.instructionSize || 'medium' 
                })
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load highlight rules:', error)
      }
    }
    loadHighlightRules()
  }, [surgeryId, symptom.briefInstruction])

  // Load feature flags for the current surgery
  const effectiveSurgeryId = surgeryId || currentSurgeryId
  useEffect(() => {
    const loadFeatures = async () => {
      try {
        const url = effectiveSurgeryId
          ? `/api/my/features?surgeryId=${effectiveSurgeryId}`
          : '/api/my/features'
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) return

        const data = await res.json()
        const features = data.features || []

        setCanUseAiInstructions(!!features.find((f: any) => f.key === 'ai_instructions' && f.enabled))
        setCanUseAiTraining(!!features.find((f: any) => f.key === 'ai_training' && f.enabled))
      } catch {
        setCanUseAiInstructions(false)
        setCanUseAiTraining(false)
      }
    }
    loadFeatures()
  }, [effectiveSurgeryId])

  // Note: do not call `/api/revertInstruction` on page load/prefetch.
  // Any revert check/update must only happen on explicit user action, and only for permitted users.

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'base':
        return 'bg-gray-200 text-gray-700'
      case 'override':
        return 'bg-nhs-blue text-white'
      case 'custom':
        return 'bg-nhs-green text-white'
      default:
        return 'bg-gray-200 text-gray-700'
    }
  }

  const highlightText = (text: string) => {
    return applyHighlightRules(text, highlightRules)
  }

  const handleVariantSelect = (variantKey: string) => {
    setSelectedVariantKey(variantKey)
    
    // Log engagement event for variant selection
    if (surgeryId && symptom.baseSymptomId) {
      fetch('/api/engagement/variant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseId: symptom.baseSymptomId,
          surgeryId: surgeryId,
          variantKey: variantKey
        })
      }).catch(err => console.error('Failed to log variant engagement:', err))
    }
  }

  const handlePushToBase = async () => {
    if (!isSuperuser) return
    setIsPushingToBase(true)
    try {
      const body =
        symptom.source === 'custom'
          ? { customSymptomId: symptom.id }
          : { baseSymptomId: symptom.baseSymptomId ?? symptom.id, surgeryId }
      const res = await fetch('/api/symptoms/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update the shared library')
      }
      setShowPushToBaseDialog(false)
      if (symptom.source === 'custom') {
        toast.success('Added to the shared library — other practices can now adopt it')
        // The practice copy is retired; move to the new base symptom's page.
        router.push(`/symptom/${data.baseSymptomId}${surgeryId ? `?surgery=${surgeryId}` : ''}`)
      } else {
        toast.success('Shared library updated to match this practice')
        router.refresh()
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update the shared library')
    } finally {
      setIsPushingToBase(false)
    }
  }

  const handleLinkedSymptomClick = async (linkName: string) => {
    if (!linkName) return

    setLoadingLinkedSymptomName(linkName)
    setLinkedSymptomError(null)

    try {
      // Build API URL with surgeryId parameter if available
      let url = `/api/symptoms/by-name?name=${encodeURIComponent(linkName)}`
      if (surgeryId) {
        url += `&surgeryId=${encodeURIComponent(surgeryId)}`
      }

      const response = await fetch(url, { cache: 'no-store' })

      if (!response.ok) {
        if (response.status === 404) {
          setLinkedSymptomError(`No symptom found with the name "${linkName}". Please check the spelling or contact your administrator.`)
        } else {
          setLinkedSymptomError('Unable to find the linked symptom. Please try again later.')
        }
        return
      }

      const data = await response.json()
      const linkedSymptom = data.symptom

      if (linkedSymptom) {
        // Navigate to the linked symptom's instruction page
        const linkUrl = `/symptom/${linkedSymptom.id}${surgeryId ? `?surgery=${surgeryId}` : ''}`
        router.push(linkUrl)
      }
    } catch (error) {
      console.error('Error looking up linked symptom:', error)
      setLinkedSymptomError('Unable to find the linked symptom. Please try again later.')
    } finally {
      setLoadingLinkedSymptomName(null)
    }
  }

  const handleRequestAISuggestion = async () => {
    setLoadingAI(true)
    setAiSuggestion(null)
    setAiBrief(null)
    setAiModel(null)
    
    try {
      const requestBody = {
        symptomId: symptom.id,
        currentText: displayText,
        briefInstruction: symptom.briefInstruction || undefined,
        highlightedText: symptom.highlightedText || undefined,
      }
      console.log('AI suggestion request body:', requestBody)
      
      const response = await fetch('/api/improveInstruction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()
      
      if (!response.ok) {
        console.error('AI suggestion API error:', response.status, data)
        throw new Error(`Failed to get AI suggestion: ${data.error || response.statusText}`)
      }
      setAiSuggestion(data.aiSuggestion)
      setAiBrief(data.aiBrief || "")
      setAiModel(data.model)
      setShowAIModal(true)
    } catch (error) {
      console.error('Error getting AI suggestion:', error)
      toast.error(error instanceof Error ? error.message : 'AI suggestion failed')
    } finally {
      setLoadingAI(false)
    }
  }

  const handleAcceptBriefOnly = async () => {
    if (!aiBrief) return
    if (!canApplyAiChanges) {
      toast.error("You don’t have permission to apply changes. Ask a surgery admin.")
      return
    }

    try {
      // Overrides save to the surgery's override row (keyed by the base symptom id) —
      // never remap to base, or the write lands on the shared library copy and stays
      // shadowed behind the existing override.
      const effectiveSource = symptom.source
      const effectiveSymptomId = symptom.source === 'override' ? (symptom.baseSymptomId ?? symptom.id) : symptom.id
      
      if (!effectiveSymptomId) {
        throw new Error('Invalid symptom configuration')
      }

      const response = await fetch('/api/updateInstruction', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symptomId: effectiveSymptomId,
          source: effectiveSource,
          surgeryId: surgeryId || undefined,
          modelUsed: aiModel,
          newBriefInstruction: aiBrief,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 403) {
          toast.error("You don’t have permission to apply changes. Ask a surgery admin.")
          return
        }
        throw new Error(`Failed to update instructions: ${errorData.error || response.statusText}`)
      }

      // Update local symptom object to reflect the change immediately
      symptom.briefInstruction = aiBrief

      // Close the modal and clear state
      setShowAIModal(false)
      setAiSuggestion(null)
      setAiBrief(null)
      setAiModel(null)

      // Show success toast
      toast.success('Brief instruction updated and logged')

      // Refresh the page to show updated content
      router.refresh()
    } catch (error) {
      // Avoid noisy stack traces for expected permission failures
      toast.error('Failed to update brief instruction')
    }
  }

  const handleAcceptFullOnly = async () => {
    if (!aiSuggestion) return
    if (!canApplyAiChanges) {
      toast.error("You don’t have permission to apply changes. Ask a surgery admin.")
      return
    }

    try {
      // Overrides save to the surgery's override row (keyed by the base symptom id) —
      // never remap to base, or the write lands on the shared library copy and stays
      // shadowed behind the existing override.
      const effectiveSource = symptom.source
      const effectiveSymptomId = symptom.source === 'override' ? (symptom.baseSymptomId ?? symptom.id) : symptom.id
      
      if (!effectiveSymptomId) {
        throw new Error('Invalid symptom configuration')
      }

      const response = await fetch('/api/updateInstruction', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symptomId: effectiveSymptomId,
          source: effectiveSource,
          surgeryId: surgeryId || undefined,
          modelUsed: aiModel,
          newInstructionsHtml: aiSuggestion,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 403) {
          toast.error("You don’t have permission to apply changes. Ask a surgery admin.")
          return
        }
        throw new Error(`Failed to update instructions: ${errorData.error || response.statusText}`)
      }

      // Update local symptom object to reflect the change immediately
      symptom.instructionsHtml = aiSuggestion

      // Close the modal and clear state
      setShowAIModal(false)
      setAiSuggestion(null)
      setAiBrief(null)
      setAiModel(null)

      // Show success toast
      toast.success('Full instruction updated and logged')

      // Refresh the page to show updated content
      router.refresh()
    } catch (error) {
      // Avoid noisy stack traces for expected permission failures
      toast.error('Failed to update full instruction')
    }
  }

  const handleAcceptBoth = async () => {
    if (!aiSuggestion || !aiBrief) return
    if (!canApplyAiChanges) {
      toast.error("You don’t have permission to apply changes. Ask a surgery admin.")
      return
    }

    try {
      // Overrides save to the surgery's override row (keyed by the base symptom id) —
      // never remap to base, or the write lands on the shared library copy and stays
      // shadowed behind the existing override.
      const effectiveSource = symptom.source
      const effectiveSymptomId = symptom.source === 'override' ? (symptom.baseSymptomId ?? symptom.id) : symptom.id
      
      if (!effectiveSymptomId) {
        throw new Error('Invalid symptom configuration')
      }

      const response = await fetch('/api/updateInstruction', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symptomId: effectiveSymptomId,
          source: effectiveSource,
          surgeryId: surgeryId || undefined,
          modelUsed: aiModel,
          newBriefInstruction: aiBrief,
          newInstructionsHtml: aiSuggestion,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 403) {
          toast.error("You don’t have permission to apply changes. Ask a surgery admin.")
          return
        }
        throw new Error(`Failed to update instructions: ${errorData.error || response.statusText}`)
      }

      // Update local symptom object to reflect the change immediately
      symptom.instructionsHtml = aiSuggestion
      symptom.briefInstruction = aiBrief

      // Close the modal and clear state
      setShowAIModal(false)
      setAiSuggestion(null)
      setAiBrief(null)
      setAiModel(null)

      // Show success toast
      toast.success('Instructions updated and logged')

      // Refresh the page to show updated content
      router.refresh()
    } catch (error) {
      // Avoid noisy stack traces for expected permission failures
      toast.error('Failed to update instructions')
    }
  }

  const handleDiscardAISuggestion = () => {
    setShowAIModal(false)
    setAiSuggestion(null)
    setAiBrief(null)
    setAiModel(null)
  }

  const handleRequestExplanation = async () => {
    setLoadingExplanation(true)
    setExplanationHtml(null)
    setExplanationModel(null)
    
    try {
      const requestBody = {
        symptomId: symptom.id,
        currentText: displayText,
        briefInstruction: symptom.briefInstruction || undefined,
      }
      console.log('AI explanation request body:', requestBody)
      
      const response = await fetch('/api/explainInstruction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()
      
      if (!response.ok) {
        console.error('AI explanation API error:', response.status, data)
        if (response.status === 401 || response.status === 403) {
          toast.error('Superuser access required')
        } else if (response.status === 500) {
          toast.error('AI explanation service unavailable')
        } else {
          throw new Error(`Failed to get AI explanation: ${data.error || response.statusText}`)
        }
        return
      }

      if (!data.explanationHtml || data.explanationHtml.trim() === '') {
        toast.error('No explanation generated.')
        return
      }

      setExplanationHtml(data.explanationHtml)
      setExplanationModel(data.model)
      setShowExplanationModal(true)
    } catch (error) {
      console.error('Error getting AI explanation:', error)
      toast.error(error instanceof Error ? error.message : 'AI explanation failed')
    } finally {
      setLoadingExplanation(false)
    }
  }

  // Map age group codes to readable strings
  const getAgeGroupLabel = (ageGroup: string): string => {
    switch (ageGroup) {
      case 'U5':
        return 'Child under 5'
      case 'O5':
        return 'Child over 5'
      case 'Adult':
        return 'Adult'
      default:
        return ageGroup
    }
  }

  const handleRequestQuestionPrompts = async () => {
    setLoadingQuestions(true)
    setQuestionPrompts(null)
    setQuestionsError(null)
    
    try {
      // When the surgery hides age bands, one entry covers all ages, so the AI
      // is asked for all-ages questions (including age-establishing ones).
      const requestBody = {
        symptomName: symptom.name,
        ...(hideAgeBands
          ? { allAges: true }
          : { ageGroup: getAgeGroupLabel(symptom.ageGroup) }),
        briefInstruction: symptom.briefInstruction || undefined,
        instructionsText: displayText || undefined,
        instructionsHtml: symptom.instructionsHtml || undefined,
      }
      console.log('AI question prompts request body:', requestBody)
      
      const response = await fetch('/api/ai/question-prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()
      
      if (!response.ok) {
        console.error('AI question prompts API error:', response.status, data)
        if (response.status === 401 || response.status === 403) {
          setQuestionsError('Access required')
          toast.error('Access required')
        } else if (response.status === 500) {
          setQuestionsError(data.error || 'AI service unavailable')
          toast.error(data.error || 'AI service unavailable')
        } else {
          const errorMsg = data.error || response.statusText
          setQuestionsError(errorMsg)
          throw new Error(`Failed to get question prompts: ${errorMsg}`)
        }
        return
      }

      if (!data.groups || !Array.isArray(data.groups) || data.groups.length === 0) {
        setQuestionsError('No questions generated')
        toast.error('No questions generated')
        return
      }

      setQuestionPrompts({
        symptom: data.symptom,
        ageGroup: data.ageGroup,
        groups: data.groups,
      })
      setShowQuestionsPanel(true)
      // Scroll to panel after a brief delay to ensure DOM has updated
      setTimeout(() => {
        questionsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (error) {
      console.error('Error getting AI question prompts:', error)
      const errorMsg = error instanceof Error ? error.message : 'Failed to generate questions'
      setQuestionsError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoadingQuestions(false)
    }
  }

  const handleCloseQuestionsPanel = () => {
    setShowQuestionsPanel(false)
    setQuestionPrompts(null)
    setQuestionsError(null)
  }

  const handleCopyAllQuestions = async () => {
    if (!questionPrompts) return

    try {
      // Build text with groups and questions
      let textToCopy = ''
      
      questionPrompts.groups.forEach((group, groupIndex) => {
        if (groupIndex > 0) {
          textToCopy += '\n'
        }
        textToCopy += `${group.label}\n`
        group.questions.forEach((question) => {
          textToCopy += `• ${question}\n`
        })
      })

      await navigator.clipboard.writeText(textToCopy.trim())
      toast.success('Questions copied to clipboard')
    } catch (error) {
      console.error('Failed to copy questions:', error)
      toast.error('Failed to copy questions. Please try again.')
    }
  }

  const handleCloseExplanationModal = () => {
    setShowExplanationModal(false)
    setExplanationHtml(null)
    setExplanationModel(null)
  }

  const handleCopyExplanation = async () => {
    if (!explanationHtml) return
    
    try {
      // Strip HTML tags for plain text copy
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = explanationHtml
      const plainText = tempDiv.textContent || tempDiv.innerText || ''
      
      await navigator.clipboard.writeText(plainText)
      toast.success('Explanation copied to clipboard')
    } catch (error) {
      console.error('Failed to copy explanation:', error)
      toast.error('Failed to copy explanation')
    }
  }

  /** Prefill the shared-variants editor from the base symptom's variants. */
  const prefillVariantState = () => {
    if (!canEditVariants) return
    const v: any = rawBaseVariants
    if (v && Array.isArray(v.ageGroups) && v.ageGroups.length > 0) {
      const heading = v.heading || ''
      const position: 'before' | 'after' = v.position === 'after' ? 'after' : 'before'
      const groups = v.ageGroups.map((g: any) => ({
        key: g.key || '',
        label: g.label || '',
        instructions: g.instructions || '',
      }))
      setEnableVariantsEdit(true)
      setEditVariantHeading(heading)
      setEditVariantPosition(position)
      setEditVariantGroups(groups)
      setOriginalVariantsJson(JSON.stringify({ heading: heading || undefined, position, ageGroups: groups }))
    } else {
      setEnableVariantsEdit(false)
      setEditVariantHeading('')
      setEditVariantPosition('before')
      setEditVariantGroups([])
      setOriginalVariantsJson('null')
    }
  }

  const resetVariantEditState = () => {
    setEnableVariantsEdit(false)
    setEditVariantHeading('')
    setEditVariantPosition('before')
    setEditVariantGroups([])
    setOriginalVariantsJson(null)
  }

  /** Current editor state as an API payload: object | null (clear) | undefined (leave). */
  const buildVariantsPayload = (): any => {
    if (enableVariantsEdit && editVariantGroups.length > 0) {
      return {
        heading: (editVariantHeading || undefined),
        position: editVariantPosition,
        ageGroups: editVariantGroups,
      }
    }
    if (!enableVariantsEdit) return null
    return undefined
  }

  /**
   * The primary variants save: to the BASE symptom for base-backed symptoms,
   * or to the custom symptom itself for practice-owned ones. Always a
   * dedicated PATCH, decoupled from the instruction save (which may target an
   * override that ignores variants entirely). Skips when nothing changed.
   */
  const saveVariantsIfChanged = async () => {
    if (!canEditVariants || !variantTargetId) return
    // No snapshot means the variant editor was never initialized — never write.
    if (originalVariantsJson === null) return
    const payload = buildVariantsPayload()
    if (payload === undefined) return
    if (JSON.stringify(payload ?? null) === originalVariantsJson) return

    const response = await fetch(`/api/admin/symptoms/${variantTargetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        isCustomSymptom
          ? { source: 'custom', surgeryId, variants: payload }
          : { source: 'base', variants: payload }
      ),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to save variants')
    }
    // Reflect locally so the chips update before the refresh lands (for
    // base-backed symptoms, only when the surgery doesn't shadow the shared
    // variants with its own).
    if (isCustomSymptom || symptom.source === 'base' || (symptom as any).overrideVariants == null) {
      ;(symptom as any).variants = payload
    }
    if (symptom.source === 'override') {
      ;(symptom as any).baseVariants = payload
    }
  }

  /** Prefill the practice-level variants panel from the surgery's override. */
  const prefillSurgeryVariantState = () => {
    if (!canEditSurgeryVariants) return
    const ov: any = (symptom as any).overrideVariants ?? null
    if (ov && Array.isArray(ov.ageGroups) && ov.ageGroups.length > 0) {
      const heading = ov.heading || ''
      const position: 'before' | 'after' = ov.position === 'after' ? 'after' : 'before'
      const groups = ov.ageGroups.map((g: any) => ({
        key: g.key || '',
        label: g.label || '',
        instructions: g.instructions || '',
      }))
      setSurgeryVariantMode('custom')
      setSurgeryVariantHeading(heading)
      setSurgeryVariantPosition(position)
      setSurgeryVariantGroups(groups)
      setOriginalSurgeryVariantsJson(JSON.stringify({ heading: heading || undefined, position, ageGroups: groups }))
    } else if (ov) {
      // Override value with no age groups = variants hidden at this practice.
      setSurgeryVariantMode('hidden')
      setSurgeryVariantHeading('')
      setSurgeryVariantPosition('before')
      setSurgeryVariantGroups([])
      setOriginalSurgeryVariantsJson(JSON.stringify({ ageGroups: [] }))
    } else {
      setSurgeryVariantMode('inherit')
      setSurgeryVariantHeading('')
      setSurgeryVariantPosition('before')
      setSurgeryVariantGroups([])
      setOriginalSurgeryVariantsJson('null')
    }
  }

  const resetSurgeryVariantState = () => {
    setSurgeryVariantMode('inherit')
    setSurgeryVariantHeading('')
    setSurgeryVariantPosition('before')
    setSurgeryVariantGroups([])
    setOriginalSurgeryVariantsJson(null)
  }

  /** Practice-level payload: null = inherit, {ageGroups:[]} = hide, object = replace. */
  const buildSurgeryVariantsPayload = (): any => {
    if (surgeryVariantMode === 'inherit') return null
    if (surgeryVariantMode === 'hidden') return { ageGroups: [] }
    return {
      heading: (surgeryVariantHeading || undefined),
      position: surgeryVariantPosition,
      ageGroups: surgeryVariantGroups,
    }
  }

  /** Saves the practice-level variant choice to the surgery's override row. */
  const saveSurgeryVariantsIfChanged = async () => {
    if (!canEditSurgeryVariants || !baseBackedSymptomId) return
    if (originalSurgeryVariantsJson === null) return
    const payload = buildSurgeryVariantsPayload()
    if (JSON.stringify(payload) === originalSurgeryVariantsJson) return

    const response = await fetch(`/api/admin/symptoms/${baseBackedSymptomId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'override', surgeryId, variants: payload }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to save practice variants')
    }
    // Reflect locally so the chips update before the refresh lands.
    ;(symptom as any).overrideVariants = payload
    ;(symptom as any).variants = payload == null ? rawBaseVariants : payload
  }

  const handleEditInstructions = () => {
    // For practice admins editing base symptoms, start with base content
    // For superusers or when editing overrides/custom, use current content
    const contentToEdit = (isPracticeAdmin && symptom.source === 'base')
      ? (symptom.instructionsHtml || symptom.instructions || '')
      : (symptom.instructionsHtml || symptom.instructions || '')

    setEditedInstructions(contentToEdit)
    setOriginalInstructions(contentToEdit)
    setInstructionsReset(false)
    prefillVariantState()
    prefillSurgeryVariantState()
    setIsEditingInstructions(true)
    setSaveError(null)
  }

  const handleCancelEdit = () => {
    setIsEditingInstructions(false)
    setEditedInstructions('')
    setInstructionsReset(false)
    resetVariantEditState()
    resetSurgeryVariantState()
    setSaveError(null)
  }

  const handleEditAll = () => {
    const initialBrief = symptom.briefInstruction || ''
    const initialHighlighted = symptom.highlightedText || ''
    const initialInstructions = symptom.instructionsHtml || symptom.instructions || ''
    setEditedName(symptom.name || '')
    setEditedBriefInstruction(initialBrief)
    setEditedHighlightedText(initialHighlighted)
    const initialLinks = symptom.linkToPages ?? (symptom.linkToPage ? [symptom.linkToPage] : [])
    setEditedLinkToPages(initialLinks)
    setOriginalLinkToPages(initialLinks)
    setEditedInstructions(initialInstructions)
    setOriginalBriefInstruction(initialBrief)
    setOriginalHighlightedText(initialHighlighted)
    setOriginalInstructions(initialInstructions)
    setBriefInstructionReset(false)
    setHighlightedTextReset(false)
    setInstructionsReset(false)
    prefillVariantState()
    prefillSurgeryVariantState()
    setIsEditingAll(true)
    setSaveError(null)
  }

  const handleCancelEditAll = () => {
    setIsEditingAll(false)
    setEditedName('')
    setEditedBriefInstruction('')
    setEditedHighlightedText('')
    setEditedLinkToPages([])
    setOriginalLinkToPages([])
    setEditedInstructions('')
    setBriefInstructionReset(false)
    setHighlightedTextReset(false)
    setInstructionsReset(false)
    resetVariantEditState()
    resetSurgeryVariantState()
    setSaveError(null)
  }

  const handleSaveInstructions = async () => {
    if (!canEditInstructions) return

    setIsSavingInstructions(true)
    setSaveError(null)

    try {
      const sanitizedHtml = sanitizeSymptomHtml(editedInstructions)
      
      // Determine the source and surgery ID for the API call
      let apiSource = symptom.source
      let apiSurgeryId = surgeryId
      
      // If practice admin is editing a base symptom, create an override
      if (isPracticeAdmin && symptom.source === 'base') {
        apiSource = 'override'
        apiSurgeryId = surgeryId
      }
      
      // Tri-state: null = reset to base default, omit = unchanged, string = override.
      const instructionsPayload: string | null | undefined = instructionsReset
        ? null
        : (sanitizedHtml === originalInstructions ? undefined : sanitizedHtml)

      const body: any = {
        source: apiSource,
        surgeryId: apiSurgeryId,
      }
      if (instructionsPayload !== undefined) {
        body.instructions = instructionsPayload // Legacy field
        body.instructionsHtml = instructionsPayload
      }

      const response = await fetch(`/api/admin/symptoms/${symptom.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save instructions')
      }

      // Variants save separately, always to the base symptom (the main save
      // above may have targeted an override, which ignores variants).
      await saveVariantsIfChanged()
      await saveSurgeryVariantsIfChanged()

      // Update the symptom object locally
      if (!instructionsReset) {
        symptom.instructionsHtml = sanitizedHtml
        symptom.instructions = sanitizedHtml
      }

      setIsEditingInstructions(false)
      setEditedInstructions('')
      setInstructionsReset(false)
      resetVariantEditState()
      resetSurgeryVariantState()

      // Refresh the page to show updated content
      router.refresh()
    } catch (error: any) {
      console.error('Error saving instructions:', error)
      setSaveError(error.message || 'Failed to save instructions. Please try again.')
    } finally {
      setIsSavingInstructions(false)
    }
  }

  const handleSaveAll = async () => {
    if (!canEditInstructions) return

    setIsSavingAll(true)
    setSaveError(null)

    try {
      const sanitizedInstructions = sanitizeSymptomHtml(editedInstructions)
      
      // Determine the source and surgery ID for the API call
      let apiSource = symptom.source
      let apiSurgeryId = surgeryId
      
      // If practice admin is editing a base symptom, create an override
      if (isPracticeAdmin && symptom.source === 'base') {
        apiSource = 'override'
        apiSurgeryId = surgeryId
      }
      
      // Practice admins customising a base symptom or editing their override can rename
      // it for their practice. An empty value clears the override and falls back to the
      // base name (the merge logic in effectiveSymptoms.ts treats empty as inherit).
      const canCustomiseName = isPracticeAdmin && (symptom.source === 'base' || symptom.source === 'override')
      const trimmedName = editedName.trim()
      const nameForPayload = canCustomiseName
        ? (trimmedName === '' ? null : trimmedName)
        : symptom.name

      // Tri-state per-field: omit when unchanged, null when user clicked
      // "Reset to default", string otherwise (including "" = explicit blank).
      const briefTrimmed = editedBriefInstruction.trim()
      const highlightedTrimmed = editedHighlightedText.trim()
      const briefPayload: string | null | undefined = briefInstructionReset
        ? null
        : (briefTrimmed === originalBriefInstruction.trim() ? undefined : briefTrimmed)
      const highlightedPayload: string | null | undefined = highlightedTextReset
        ? null
        : (highlightedTrimmed === originalHighlightedText.trim() ? undefined : highlightedTrimmed)
      const instructionsPayload: string | null | undefined = instructionsReset
        ? null
        : (sanitizedInstructions === originalInstructions ? undefined : sanitizedInstructions)

      const payload: any = {
        source: apiSource,
        surgeryId: apiSurgeryId,
        name: nameForPayload,
        ageGroup: symptom.ageGroup, // Keep existing age group
      }
      // Only send links when actually changed, so an untouched override keeps
      // inheriting the base symptom's links.
      const cleanedLinks = editedLinkToPages.map(l => l.trim()).filter(l => l !== '')
      const linksChanged = JSON.stringify(cleanedLinks) !== JSON.stringify(originalLinkToPages)
      if (linksChanged) payload.linkToPages = cleanedLinks
      if (briefPayload !== undefined) payload.briefInstruction = briefPayload
      if (highlightedPayload !== undefined) payload.highlightedText = highlightedPayload
      if (instructionsPayload !== undefined) {
        payload.instructions = instructionsPayload // Legacy field
        payload.instructionsHtml = instructionsPayload
      }

      const response = await fetch(`/api/admin/symptoms/${symptom.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save changes')
      }

      // Variants save separately, always to the base symptom (the main save
      // above may have targeted an override, which ignores variants).
      await saveVariantsIfChanged()
      await saveSurgeryVariantsIfChanged()

      // Update the symptom object locally
      if (canCustomiseName && trimmedName !== '') {
        symptom.name = trimmedName
      }
      symptom.briefInstruction = editedBriefInstruction.trim()
      symptom.highlightedText = editedHighlightedText.trim()
      symptom.linkToPages = cleanedLinks.length > 0 ? cleanedLinks : null
      symptom.linkToPage = cleanedLinks[0] ?? null
      symptom.instructionsHtml = sanitizedInstructions
      symptom.instructions = sanitizedInstructions
      symptom.source = apiSource // Update source if override was created

      setIsEditingAll(false)
      setEditedName('')
      setEditedBriefInstruction('')
      setEditedHighlightedText('')
      setEditedLinkToPages([])
      setOriginalLinkToPages([])
      setEditedInstructions('')
      resetVariantEditState()
      resetSurgeryVariantState()

      // Refresh the page to show updated content
      router.refresh()
    } catch (error: any) {
      console.error('Error saving all fields:', error)
      setSaveError(error.message || 'Failed to save changes. Please try again.')
    } finally {
      setIsSavingAll(false)
    }
  }

  const handleHideSymptom = async () => {
    if (!isPracticeAdmin || !surgeryId) return

    setIsHidingSymptom(true)
    setHideError(null)

    try {
      const response = await fetch(`/api/admin/symptoms/${symptom.id}?source=base&action=hide&surgeryId=${surgeryId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to hide symptom')
      }

      // Redirect back to symptoms list
      router.push(`/s/${currentSurgeryId || surgeryId}`)
    } catch (error: any) {
      console.error('Error hiding symptom:', error)
      setHideError(error.message || 'Failed to hide symptom. Please try again.')
    } finally {
      setIsHidingSymptom(false)
    }
  }

  const handleDeleteSymptom = async () => {
    if (!isSuperuser && !isPracticeAdmin) return

    setIsDeletingSymptom(true)
    setDeleteError(null)

    try {
      const response = await fetch(`/api/admin/symptoms/${symptom.id}?source=custom&surgeryId=${encodeURIComponent(surgeryId || '')}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete symptom')
      }

      // Redirect back to symptoms list
      router.push(`/s/${currentSurgeryId || surgeryId}`)
    } catch (error: any) {
      console.error('Error deleting symptom:', error)
      setDeleteError(error.message || 'Failed to delete symptom. Please try again.')
    } finally {
      setIsDeletingSymptom(false)
    }
  }

  const headerContainerClasses = showBlueHeader
    ? 'rounded-lg shadow-md p-6 mb-6 border border-[#173b80] bg-[#264c96] text-white'
    : 'bg-white rounded-lg shadow-md p-6 mb-6'

  const editButtonClasses = showBlueHeader
    ? 'px-4 py-2 text-sm font-medium text-[#264c96] bg-white border border-transparent rounded-lg hover:bg-white/90 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#264c96]'
    : 'px-4 py-2 text-sm font-medium text-nhs-blue bg-nhs-light-blue border border-nhs-blue rounded-lg hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2'

  return (
    <>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className={headerContainerClasses}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className={`text-3xl font-bold ${showBlueHeader ? 'text-white' : 'text-nhs-dark-blue'}`}>
                {symptom.name}
              </h1>
              {!hideAgeBands && (
                <span
                  className={
                    showBlueHeader
                      ? 'mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white border border-white/40'
                      : `mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${ageGroupBadgeClasses(symptom.ageGroup)}`
                  }
                  title={`This version of the symptom applies to ${formatAgeGroupDescription(symptom.ageGroup)}.`}
                >
                  {formatAgeGroupLabel(symptom.ageGroup)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {symptom.source !== 'override' && (
                <span
                  className={
                    showBlueHeader
                      ? 'px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white border border-white/40'
                      : `px-3 py-1 rounded-full text-sm font-medium ${getSourceColor(symptom.source)}`
                  }
                >
                  {symptom.source}
                </span>
              )}
              {canEditInstructions && !isEditingAll && !isEditingInstructions && (
                <button
                  onClick={handleEditAll}
                  className={editButtonClasses}
                >
                  {isPracticeAdmin && symptom.source === 'base' ? 'Customise All Fields' : 'Edit All Fields'}
                </button>
              )}
            </div>
          </div>
          
          {isEditingAll ? (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-800 text-sm">
                  {hideAgeBands ? (
                    <>
                      <strong>All ages:</strong> this surgery shows one entry per symptom covering all ages.
                      Include any age-specific advice (under 5, 5–17, adult) within these instructions.
                    </>
                  ) : (
                    <>
                      <strong>Age group:</strong> this version of “{symptom.name}” is for{' '}
                      <strong>{formatAgeGroupDescription(symptom.ageGroup)}</strong> only, so keep the wording specific to that age group.
                      The Under 5, 5–17 and Adult versions are edited and clinically reviewed separately.
                    </>
                  )}
                </p>
              </div>
              {isPracticeAdmin && symptom.source === 'base' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-700 text-sm">
                    <strong>Customising for your practice:</strong> You’re creating a custom version of this symptom for your surgery. The original base symptom will remain unchanged for other practices.
                  </p>
                </div>
              )}

              {isPracticeAdmin && (symptom.source === 'base' || symptom.source === 'override') && (
                <div>
                  <label className="block text-sm font-medium text-nhs-dark-blue mb-2">
                    Display name (optional)
                  </label>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue"
                    placeholder={symptom.name || 'Enter display name...'}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Customise how this symptom is named for your practice. Leave blank to use the standard name.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-nhs-dark-blue mb-2">
                  Brief Instruction
                </label>
                {briefInstructionReset ? (
                  <div className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-600 italic">
                    Will reset to default text on save.{' '}
                    <button
                      type="button"
                      onClick={() => setBriefInstructionReset(false)}
                      className="text-nhs-blue underline hover:text-nhs-dark-blue not-italic"
                    >
                      Undo
                    </button>
                  </div>
                ) : (
                  <textarea
                    value={editedBriefInstruction}
                    onChange={(e) => setEditedBriefInstruction(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue"
                    rows={2}
                    placeholder="Enter brief instruction..."
                  />
                )}
                {isOverrideContext && !briefInstructionReset && (
                  <button
                    type="button"
                    onClick={() => setBriefInstructionReset(true)}
                    className="text-sm text-nhs-blue hover:underline mt-1"
                  >
                    Reset to default
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className={`flex items-start gap-4 mb-4 ${showBlueHeader ? 'text-white' : ''}`}>
              <p 
                className={`text-lg flex-1 ${showBlueHeader ? 'text-white' : 'text-nhs-grey'}`}
                dangerouslySetInnerHTML={{ 
                  __html: highlightText(symptom.briefInstruction || '') 
                }}
              />
              {imageIcon && enableImageIcons && (() => {
                // Map size to Tailwind classes
                const sizeClasses = {
                  small: 'w-24 h-24',
                  medium: 'w-32 h-32',
                  large: 'w-48 h-48'
                }
                const sizeClass = sizeClasses[imageIcon.instructionSize as keyof typeof sizeClasses] || sizeClasses.medium
                
                return (
                  <div className={`relative ${sizeClass} flex-shrink-0 ${showBlueHeader ? 'bg-white/10 rounded-lg p-2' : ''}`}>
                    <Image
                      src={imageIcon.imageUrl}
                      alt=""
                      fill
                      className="object-contain"
                    />
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        {/* Highlighted Text - Important Notice */}
        {isEditingAll ? (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-nhs-dark-blue mb-2">
                Important Notice (Highlighted Text)
              </label>
              {highlightedTextReset ? (
                <div className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-600 italic">
                  Will reset to default text on save.{' '}
                  <button
                    type="button"
                    onClick={() => setHighlightedTextReset(false)}
                    className="text-nhs-blue underline hover:text-nhs-dark-blue not-italic"
                  >
                    Undo
                  </button>
                </div>
              ) : (
                <textarea
                  value={editedHighlightedText}
                  onChange={(e) => setEditedHighlightedText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue"
                  rows={3}
                  placeholder="Enter important notice text..."
                />
              )}
              {isOverrideContext && !highlightedTextReset && (
                <button
                  type="button"
                  onClick={() => setHighlightedTextReset(true)}
                  className="text-sm text-nhs-blue hover:underline mt-1"
                >
                  Reset to default
                </button>
              )}
              <p className="text-sm text-gray-500 mt-1">
                This text will appear in a red highlighted box above the main instructions.
              </p>
            </div>
          </div>
        ) : (
          symptom.highlightedText && (
            <div className="bg-red-50 border-l-4 border-nhs-red rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-nhs-red mb-2">
                Important Notice
              </h3>
              <p 
                className="text-nhs-red font-medium"
                dangerouslySetInnerHTML={{ 
                  __html: highlightText(symptom.highlightedText) 
                }}
              />
            </div>
          )
        )}

        {/* Variant Selection - Age Groups */}
        {hasVariants && !isEditingInstructions && !isEditingAll && (
          <>
            {(!variants.position || variants.position === 'before') && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                {(variants.heading && variants.heading.trim() !== '') && (
                  <h3 className="text-lg font-semibold text-nhs-dark-blue mb-4">
                    {variants.heading}
                  </h3>
                )}
                <div className="flex flex-wrap gap-3">
                  {variants.ageGroups.map((variant: any) => (
                    <button
                      key={variant.key}
                      onClick={() => handleVariantSelect(variant.key)}
                      aria-pressed={selectedVariantKey === variant.key}
                      className={`px-4 py-2 rounded-xl border-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 ${
                        selectedVariantKey === variant.key
                          ? 'bg-nhs-blue text-white border-nhs-blue'
                          : 'bg-white text-nhs-dark-blue border-nhs-grey hover:bg-nhs-light-grey'
                      }`}
                    >
                      {variant.label}
                    </button>
                  ))}
                  {selectedVariantKey && (
                    <button
                      onClick={() => setSelectedVariantKey(null)}
                      className="px-4 py-2 rounded-xl border-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 bg-white text-nhs-dark-blue border-nhs-grey hover:bg-nhs-light-grey"
                    >
                      Revert to original
                    </button>
                  )}
                </div>
                {activeVariantLabel && (
                  <p className="text-sm text-nhs-grey mt-3">
                    Advice shown: {activeVariantLabel}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* Main Instructions */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-nhs-dark-blue">
                Instructions
              </h2>
              {symptom.source === 'override' && (
                <span className="px-2 py-1 text-xs font-medium bg-nhs-blue text-white rounded-full">
                  Practice Customised
                </span>
              )}
              {symptom.source === 'custom' && (
                <span className="px-2 py-1 text-xs font-medium bg-nhs-green text-white rounded-full">
                  Practice Created
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isEditingInstructions && !isEditingAll && (
                <>
                  {canUseAiInstructions && (
                    <button
                      onClick={handleRequestAISuggestion}
                      disabled={loadingAI}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-green focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Suggest improved wording (AI)"
                      aria-label="Suggest improved wording (AI)"
                    >
                      {loadingAI ? (
                        <svg className="animate-spin h-4 w-4 text-nhs-green" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : (
                        <span className="text-xs font-semibold text-nhs-green">AI</span>
                      )}
                    </button>
                  )}
                </>
              )}
              {canEditInstructions && !isEditingInstructions && !isEditingAll && (
                <button
                  onClick={handleEditInstructions}
                  className="px-4 py-2 text-sm font-medium text-nhs-blue bg-nhs-light-blue border border-nhs-blue rounded-lg hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
                >
                  {isPracticeAdmin && symptom.source === 'base' ? 'Customise Instructions' : 'Edit Instructions'}
                </button>
              )}
            </div>
          </div>
          
          {isEditingInstructions || isEditingAll ? (
            <div className="space-y-4">
              {isEditingInstructions && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-800 text-sm">
                    {hideAgeBands ? (
                      <>
                        <strong>All ages:</strong> this surgery shows one entry per symptom covering all ages.
                        Include any age-specific advice (under 5, 5–17, adult) within these instructions.
                      </>
                    ) : (
                      <>
                        <strong>Age group:</strong> this version of “{symptom.name}” is for{' '}
                        <strong>{formatAgeGroupDescription(symptom.ageGroup)}</strong> only, so keep the wording specific to that age group.
                        The Under 5, 5–17 and Adult versions are edited and clinically reviewed separately.
                      </>
                    )}
                  </p>
                </div>
              )}
              {isEditingInstructions && isPracticeAdmin && symptom.source === 'base' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-700 text-sm">
                    <strong>Customising for your practice:</strong> You’re creating a custom version of these instructions for your surgery. The original base instructions will remain unchanged for other practices.
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-nhs-dark-blue mb-2">
                  Detailed Instructions
                </label>
                {instructionsReset ? (
                  <div className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-600 italic">
                    Will reset to default instructions on save.{' '}
                    <button
                      type="button"
                      onClick={() => setInstructionsReset(false)}
                      className="text-nhs-blue underline hover:text-nhs-dark-blue not-italic"
                    >
                      Undo
                    </button>
                  </div>
                ) : (
                  <RichTextEditor
                    docId={`symptom:${symptom.id}:instructions`}
                    value={editedInstructions}
                    onChange={setEditedInstructions}
                    placeholder="Enter detailed instructions with formatting..."
                    height={300}
                    imageUpload={symptomImageUpload}
                  />
                )}
                {isOverrideContext && !instructionsReset && (
                  <button
                    type="button"
                    onClick={() => setInstructionsReset(true)}
                    className="text-sm text-nhs-blue hover:underline mt-1"
                  >
                    Reset to default
                  </button>
                )}
              </div>

              {canEditVariants && (
                <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-nhs-dark-blue">
                      {surgeryId && !isCustomSymptom ? 'Shared variants (all practices)' : 'Variants'}
                    </h3>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4" checked={enableVariantsEdit} onChange={(e) => setEnableVariantsEdit(e.target.checked)} />
                      Enable variants
                    </label>
                  </div>
                  {symptom.source === 'override' && (
                    <p className="mb-3 text-xs text-gray-500">
                      These variants come from the base symptom and apply to every practice unless a practice sets its own below.
                    </p>
                  )}
                  {isCustomSymptom && (
                    <p className="mb-3 text-xs text-gray-500">
                      This symptom belongs to your practice — variants apply here only.
                    </p>
                  )}
                  {enableVariantsEdit && (
                    <VariantGroupsEditor
                      docIdPrefix={`symptom:${variantTargetId}:${isCustomSymptom ? 'custom' : 'base'}`}
                      heading={editVariantHeading}
                      onHeadingChange={setEditVariantHeading}
                      position={editVariantPosition}
                      onPositionChange={setEditVariantPosition}
                      groups={editVariantGroups}
                      onGroupsChange={setEditVariantGroups}
                      imageUpload={variantImageUpload}
                    />
                  )}
                </div>
              )}

              {canEditSurgeryVariants && (
                <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                  <h3 className="text-sm font-semibold text-nhs-dark-blue mb-1">Variants at this practice</h3>
                  <p className="mb-3 text-xs text-gray-500">
                    Choose how age-group variants appear for this practice. Customising or hiding them here never
                    changes the shared variants other practices see.
                  </p>
                  <div className="space-y-2" role="radiogroup" aria-label="Variants at this practice">
                    {([
                      { value: 'inherit', label: 'Use shared variants', description: 'Show the variants from the shared symptom library.' },
                      { value: 'custom', label: 'Customise for this practice', description: 'Replace the shared variants with practice-specific ones.' },
                      { value: 'hidden', label: 'Hide variants at this practice', description: 'Show no age-group variants on this symptom.' },
                    ] as const).map((option) => (
                      <label key={option.value} className="flex items-start gap-2 text-sm">
                        <input
                          type="radio"
                          name="surgery-variant-mode"
                          className="mt-0.5 h-4 w-4"
                          checked={surgeryVariantMode === option.value}
                          onChange={() => {
                            setSurgeryVariantMode(option.value)
                            // Seed the custom editor from the currently effective
                            // variants so customising starts from what staff see.
                            if (option.value === 'custom' && surgeryVariantGroups.length === 0) {
                              const seed: any = variants
                              if (seed && Array.isArray(seed.ageGroups) && seed.ageGroups.length > 0) {
                                setSurgeryVariantHeading(seed.heading || '')
                                setSurgeryVariantPosition(seed.position === 'after' ? 'after' : 'before')
                                setSurgeryVariantGroups(seed.ageGroups.map((g: any) => ({
                                  key: g.key || '',
                                  label: g.label || '',
                                  instructions: g.instructions || '',
                                })))
                              }
                            }
                          }}
                        />
                        <span>
                          <span className="font-medium text-gray-800">{option.label}</span>
                          <span className="block text-xs text-gray-500">{option.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {surgeryVariantMode === 'custom' && (
                    <div className="mt-3">
                      <VariantGroupsEditor
                        docIdPrefix={`symptom:${baseBackedSymptomId}:surgery:${surgeryId}`}
                        heading={surgeryVariantHeading}
                        onHeadingChange={setSurgeryVariantHeading}
                        position={surgeryVariantPosition}
                        onPositionChange={setSurgeryVariantPosition}
                        groups={surgeryVariantGroups}
                        onGroupsChange={setSurgeryVariantGroups}
                        imageUpload={surgeryId ? { kind: 'symptom', surgeryId } : variantImageUpload}
                      />
                    </div>
                  )}
                </div>
              )}
              
              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">
                    {saveError}
                  </p>
                </div>
              )}
              
              <div className="flex space-x-3">
                <button
                  onClick={isEditingAll ? handleSaveAll : handleSaveInstructions}
                  disabled={isSavingInstructions || isSavingAll}
                  className="px-4 py-2 bg-nhs-green text-white rounded-lg hover:bg-green-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-nhs-green focus:ring-offset-2"
                >
                  {(isSavingInstructions || isSavingAll) ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </button>
                
                <button
                  onClick={isEditingAll ? handleCancelEditAll : handleCancelEdit}
                  disabled={isSavingInstructions || isSavingAll}
                  className="px-4 py-2 border border-nhs-grey text-nhs-grey rounded-lg hover:bg-nhs-light-grey transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-nhs-grey focus:ring-offset-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="prose max-w-none">
              {displayText ? (
                <div 
                  className="text-nhs-grey leading-relaxed prose-headings:text-nhs-dark-blue prose-a:text-nhs-blue prose-a:underline hover:prose-a:text-nhs-dark-blue prose-strong:text-nhs-dark-blue prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-100 prose-pre:p-4 prose-pre:rounded prose-pre:overflow-x-auto"
                  dangerouslySetInnerHTML={{ 
                    __html: sanitizeAndFormatSymptomContent(highlightText(displayText))
                  }}
                />
              ) : (
                <div className="text-gray-500 italic">
                  No detailed instructions available. Please contact your healthcare provider for guidance.
                </div>
              )}
            </div>
          )}
          
          {/* Suggested Questions Panel */}
          {showQuestionsPanel && questionPrompts && (
            <div ref={questionsPanelRef} className="mt-6 bg-nhs-light-blue border border-nhs-blue rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-nhs-dark-blue mb-1">
                    Suggested wording for questions to ask
                  </h3>
                  <p className="text-sm text-nhs-grey leading-relaxed">
                    These questions are carefully worded to help you ask safely and consistently. Please try to use the phrasing as written.
                  </p>
                  <p className="text-sm text-nhs-grey mt-1">
                    For {questionPrompts.symptom}{questionPrompts.ageGroup ? ` (${questionPrompts.ageGroup})` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCopyAllQuestions}
                    className="text-sm text-nhs-blue hover:text-nhs-dark-blue underline focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 rounded"
                    aria-label="Copy all questions to clipboard"
                  >
                    Copy all questions
                  </button>
                  <button
                    onClick={handleCloseQuestionsPanel}
                    className="text-nhs-grey hover:text-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 rounded"
                    aria-label="Close suggested questions"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {questionPrompts.groups.map((group, groupIndex) => (
                <div key={groupIndex} className="mb-6 last:mb-0">
                  <h4 className="text-base font-bold text-slate-800 mb-3">
                    {group.label}
                  </h4>
                  <ul className="space-y-2 ml-4">
                    {group.questions.map((question, questionIndex) => (
                      <li key={questionIndex} className="text-nhs-grey list-disc">
                        {question}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              
              <div className="mt-6 pt-4 border-t border-nhs-blue/20">
                <p className="text-xs text-nhs-grey italic">
                  These are suggested questions only. Always follow the written instructions and your practice policies if unsure.
                </p>
              </div>
            </div>
          )}
          
          {questionsError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">
                {questionsError}
              </p>
            </div>
          )}
          
          {/* Footer Actions */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2 justify-between">
            <div className="flex gap-2">
              {!isEditingInstructions && !isEditingAll && canUseAiTraining && (
                <button
                  onClick={handleRequestQuestionPrompts}
                  disabled={loadingQuestions}
                  className="px-4 py-2 rounded-md bg-white border border-nhs-blue text-sm hover:bg-nhs-light-blue font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Get questions to ask (AI)"
                  aria-label="Get questions to ask"
                >
                  {loadingQuestions ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-nhs-blue" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating questions…
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span>✨</span>
                      <span>Get Questions to Ask</span>
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => setShowSuggestionModal(true)}
                className="px-4 py-2 rounded-md bg-white border border-gray-300 text-sm hover:bg-gray-50 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-green focus:ring-offset-1"
              >
                Suggest an improvement
              </button>
              
              {isPracticeAdmin && symptom.source === 'base' && !isEditingInstructions && !isEditingAll && (
                <button
                  onClick={handleHideSymptom}
                  disabled={isHidingSymptom}
                  className="px-4 py-2 rounded-md bg-red-50 text-red-700 border border-red-100 text-sm hover:bg-red-100 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                >
                  {isHidingSymptom ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Hiding...
                    </span>
                  ) : (
                    'Hide symptom for practice'
                  )}
                </button>
              )}
              
              {(isSuperuser || isPracticeAdmin) && symptom.source === 'custom' && !isEditingInstructions && !isEditingAll && (
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="px-4 py-2 rounded-md bg-red-50 text-red-700 border border-red-100 text-sm hover:bg-red-100 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                >
                  Delete symptom
                </button>
              )}

              {isSuperuser && !isEditingInstructions && !isEditingAll && (symptom.source === 'override' || symptom.source === 'custom') && (
                <button
                  onClick={() => setShowPushToBaseDialog(true)}
                  className="px-4 py-2 rounded-md bg-nhs-light-blue text-nhs-dark-blue border border-nhs-blue text-sm hover:bg-blue-100 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-1"
                >
                  {symptom.source === 'custom' ? 'Promote to shared library' : 'Update base to match'}
                </button>
              )}
            </div>
            <button
              onClick={() => {
                if (fromParam === 'clinical-review') {
                  router.push('/admin?tab=clinical-review')
                } else {
                  window.history.back()
                }
              }}
              className="px-4 py-2 rounded-md bg-white border border-gray-200 text-sm hover:bg-gray-50 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-1"
            >
              {fromParam === 'clinical-review' ? 'Back to Clinical Review' : 'Back to symptoms'}
            </button>
          </div>
        </div>

        {/* Related symptom links */}
        {isEditingAll ? (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-nhs-dark-blue mb-2">
                Links to Related Symptoms
              </label>
              <RelatedSymptomsEditor
                value={editedLinkToPages}
                onChange={setEditedLinkToPages}
                surgeryId={surgeryId}
              />
            </div>
          </div>
        ) : (
          displayLinkToPages.length > 0 && (
            <div className="bg-nhs-light-blue border border-nhs-blue rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-nhs-dark-blue mb-2">
                Related Information
              </h3>
              <p className="text-nhs-grey mb-3">
                {displayLinkToPages.length === 1
                  ? `For more detailed information about ${displayLinkToPages[0]}, please see:`
                  : 'For more detailed information, please see:'}
              </p>
              <div className="flex flex-col items-start gap-2">
                {displayLinkToPages.map(linkName => (
                  <button
                    key={linkName}
                    onClick={() => handleLinkedSymptomClick(linkName)}
                    disabled={loadingLinkedSymptomName !== null}
                    className="text-nhs-blue font-medium hover:text-nhs-dark-blue hover:underline focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={`View instructions for ${linkName}`}
                  >
                    {loadingLinkedSymptomName === linkName ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Loading...
                      </span>
                    ) : (
                      `→ ${linkName}`
                    )}
                  </button>
                ))}
              </div>

              {linkedSymptomError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">
                    {linkedSymptomError}
                  </p>
                </div>
              )}
            </div>
          )
        )}

        {/* Variant Selection after instructions (if configured) */}
        {hasVariants && !isEditingInstructions && !isEditingAll && variants.position === 'after' && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            {(variants.heading && variants.heading.trim() !== '') && (
              <h3 className="text-lg font-semibold text-nhs-dark-blue mb-4">
                {variants.heading}
              </h3>
            )}
            <div className="flex flex-wrap gap-3">
              {variants.ageGroups.map((variant: any) => (
                <button
                  key={variant.key}
                  onClick={() => handleVariantSelect(variant.key)}
                  aria-pressed={selectedVariantKey === variant.key}
                  className={`px-4 py-2 rounded-xl border-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 ${
                    selectedVariantKey === variant.key
                      ? 'bg-nhs-blue text-white border-nhs-blue'
                      : 'bg-white text-nhs-dark-blue border-nhs-grey hover:bg-nhs-light-grey'
                  }`}
                >
                  {variant.label}
                </button>
              ))}
              {selectedVariantKey && (
                <button
                  onClick={() => setSelectedVariantKey(null)}
                  className="px-4 py-2 rounded-xl border-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 bg-white text-nhs-dark-blue border-nhs-grey hover:bg-nhs-light-grey"
                >
                  Revert to original
                </button>
              )}
            </div>
            {activeVariantLabel && (
              <p className="text-sm text-nhs-grey mt-3">
                Advice shown: {activeVariantLabel}
              </p>
            )}
          </div>
        )}
        
        {hideError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">
              {hideError}
            </p>
          </div>
        )}
        
        {deleteError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">
              {deleteError}
            </p>
          </div>
        )}
      </div>

      {/* Push-to-base confirmation (superuser) */}
      <Dialog
        open={showPushToBaseDialog}
        onClose={() => setShowPushToBaseDialog(false)}
        title={symptom.source === 'custom' ? 'Promote to shared library' : 'Update base symptom'}
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setShowPushToBaseDialog(false)} disabled={isPushingToBase}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handlePushToBase} loading={isPushingToBase}>
              {symptom.source === 'custom' ? 'Promote symptom' : 'Update base symptom'}
            </Button>
          </div>
        }
      >
        {symptom.source === 'custom' ? (
          <p className="text-sm text-gray-700">
            This adds “{symptom.name}” to the shared library. It stays enabled for this practice, and other
            practices will see it as <span className="font-medium">available to adopt</span> in their Symptom
            Library — it stays disabled for them until they choose to enable it.
          </p>
        ) : (
          <p className="text-sm text-gray-700">
            This replaces the shared library content for “{symptom.name}” with this practice&apos;s customised
            version, for <span className="font-medium">every practice</span> that uses the base symptom. This
            practice&apos;s customisation marker is then removed, since its version and the base version will
            match.
          </p>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-nhs-dark-blue mb-4">
              Delete Symptom
            </h3>
            <p className="text-nhs-grey mb-6">
              Are you sure you want to delete “{symptom.name}”? This action cannot be undone and will permanently remove this symptom from your practice.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 border border-nhs-grey text-nhs-grey rounded-lg hover:bg-nhs-light-grey transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSymptom}
                disabled={isDeletingSymptom}
                className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeletingSymptom ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Deleting...
                  </span>
                ) : (
                  'Delete Symptom'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Suggestion Modal */}
      {showAIModal && aiSuggestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-nhs-dark-blue">
                AI Suggestion Preview
              </h2>
              <button
                onClick={handleDiscardAISuggestion}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-nhs-blue rounded"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Current version */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-nhs-dark-blue mb-4">
                    Current version
                  </h3>
                  
                  {/* Current brief instruction */}
                  <div>
                    <h4 className="text-sm font-medium text-nhs-dark-blue mb-2">Brief instruction</h4>
                    <div className="prose max-w-none">
                      <div 
                        className="text-nhs-grey leading-relaxed border border-gray-300 rounded-lg p-4 bg-gray-50"
                      >
                        {symptom.briefInstruction || '(none provided)'}
                      </div>
                    </div>
                  </div>

                  {/* Current full instruction */}
                  <div>
                    <h4 className="text-sm font-medium text-nhs-dark-blue mb-2">Full instruction</h4>
                    <div className="prose max-w-none">
                      <div 
                        className="text-nhs-grey leading-relaxed prose-headings:text-nhs-dark-blue prose-a:text-nhs-blue prose-a:underline hover:prose-a:text-nhs-dark-blue prose-strong:text-nhs-dark-blue prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-100 prose-pre:p-4 prose-pre:rounded prose-pre:overflow-x-auto border border-gray-300 rounded-lg p-4 bg-gray-50"
                        dangerouslySetInnerHTML={{ 
                          __html: sanitizeAndFormatSymptomContent(highlightText(displayText))
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* AI suggestion */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-nhs-green mb-4">
                    AI suggestion (not saved)
                  </h3>

                  {/* AI brief instruction */}
                  <div>
                    <h4 className="text-sm font-medium text-nhs-green mb-2">AI brief instruction</h4>
                    <div className="prose max-w-none">
                      <div 
                        className="text-nhs-grey leading-relaxed border border-nhs-green rounded-lg p-4 bg-green-50"
                      >
                        {aiBrief || '(none provided)'}
                      </div>
                    </div>
                  </div>

                  {/* AI full instruction */}
                  <div>
                    <h4 className="text-sm font-medium text-nhs-green mb-2">AI full instruction</h4>
                    <div className="prose max-w-none">
                      <div 
                        className="text-nhs-grey leading-relaxed prose-headings:text-nhs-dark-blue prose-a:text-nhs-blue prose-a:underline hover:prose-a:text-nhs-dark-blue prose-strong:text-nhs-dark-blue prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-100 prose-pre:p-4 prose-pre:rounded prose-pre:overflow-x-auto border border-nhs-green rounded-lg p-4 bg-green-50"
                        dangerouslySetInnerHTML={{ 
                          __html: sanitizeAndFormatSymptomContent(aiSuggestion)
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t flex-wrap">
              <button
                onClick={handleDiscardAISuggestion}
                className="px-6 py-2 border border-nhs-grey text-nhs-grey rounded-lg hover:bg-nhs-light-grey transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-nhs-grey focus:ring-offset-2"
              >
                Cancel
              </button>
              {!canApplyAiChanges && (
                <p className="self-center text-sm text-nhs-grey">
                  Admin only — ask a surgery admin to apply changes.
                </p>
              )}
              <button
                onClick={handleAcceptBriefOnly}
                disabled={!aiBrief || !canApplyAiChanges}
                className="px-6 py-2 bg-nhs-blue text-white rounded-lg hover:bg-blue-600 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Replace Brief only
              </button>
              <button
                onClick={handleAcceptFullOnly}
                disabled={!aiSuggestion || !canApplyAiChanges}
                className="px-6 py-2 bg-nhs-blue text-white rounded-lg hover:bg-blue-600 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Replace Full only
              </button>
              <button
                onClick={handleAcceptBoth}
                disabled={!aiSuggestion || !aiBrief || !canApplyAiChanges}
                className="px-6 py-2 bg-nhs-green text-white rounded-lg hover:bg-green-600 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-nhs-green focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Replace Both
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Explanation Modal */}
      {showExplanationModal && explanationHtml && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-nhs-dark-blue">
                AI Explanation / Training Guide
              </h2>
              <button
                onClick={handleCloseExplanationModal}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-nhs-blue rounded"
                aria-label="Close explanation modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose max-w-none prose-headings:text-nhs-dark-blue prose-h3:text-lg prose-h3:font-semibold prose-p:text-nhs-grey prose-ul:text-nhs-grey prose-li:text-nhs-grey">
                <div 
                  className="text-nhs-grey leading-relaxed"
                  dangerouslySetInnerHTML={{ 
                    __html: sanitizeAndFormatSymptomContent(explanationHtml)
                  }}
                />
              </div>
              {explanationModel && (
                <p className="text-xs text-gray-500 mt-4">
                  Generated by {explanationModel}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t flex-wrap">
              <button
                onClick={handleCloseExplanationModal}
                className="px-6 py-2 border border-nhs-grey text-nhs-grey rounded-lg hover:bg-nhs-light-grey transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-nhs-grey focus:ring-offset-2"
              >
                Close
              </button>
              <button
                onClick={handleCopyExplanation}
                className="px-6 py-2 bg-nhs-blue text-white rounded-lg hover:bg-blue-600 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      <SuggestFeatureDialog
        open={showSuggestionModal}
        onClose={() => setShowSuggestionModal(false)}
        defaultType="SYMPTOM_CONTENT"
        symptomContext={{ baseId: symptom.id, symptomName: symptom.name }}
        surgeryId={surgeryId}
      />
    </>
  )
}
