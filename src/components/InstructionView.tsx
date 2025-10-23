'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import SuggestionModal from './SuggestionModal'
import { applyHighlightRules, HighlightRule } from '@/lib/highlighting'
import { sanitizeAndFormatContent, sanitizeHtml } from '@/lib/sanitizeHtml'
import RichTextEditor from './rich-text/RichTextEditor'

interface InstructionViewProps {
  symptom: EffectiveSymptom
  surgeryId?: string
}

export default function InstructionView({ symptom, surgeryId }: InstructionViewProps) {
  const [showSuggestionModal, setShowSuggestionModal] = useState(false)
  const [highlightRules, setHighlightRules] = useState<HighlightRule[]>([])
  const [isLoadingLinkedSymptom, setIsLoadingLinkedSymptom] = useState(false)
  const [linkedSymptomError, setLinkedSymptomError] = useState<string | null>(null)
  const [isEditingInstructions, setIsEditingInstructions] = useState(false)
  const [editedInstructions, setEditedInstructions] = useState('')
  const [isSavingInstructions, setIsSavingInstructions] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isEditingAll, setIsEditingAll] = useState(false)
  const [editedBriefInstruction, setEditedBriefInstruction] = useState('')
  const [editedHighlightedText, setEditedHighlightedText] = useState('')
  const [editedLinkToPage, setEditedLinkToPage] = useState('')
  const [isSavingAll, setIsSavingAll] = useState(false)
  const router = useRouter()
  const { data: session } = useSession()

  // Check if user is superuser
  const isSuperuser = session?.user && (session.user as any).globalRole === 'SUPERUSER'
  
  // Check if user is practice admin for this surgery
  const isPracticeAdmin = session?.user && surgeryId && 
    (session.user as any).memberships?.some((m: any) => 
      m.surgeryId === surgeryId && m.role === 'ADMIN'
    )
  
  // Can edit if superuser or practice admin
  const canEditInstructions = isSuperuser || isPracticeAdmin

  // Load highlight rules from API
  useEffect(() => {
    const loadHighlightRules = async () => {
      try {
        // Build URL with surgeryId parameter if available
        let url = '/api/highlights'
        if (surgeryId) {
          url += `?surgeryId=${encodeURIComponent(surgeryId)}`
        }
        
        const response = await fetch(url, { cache: 'no-store' })
        if (response.ok) {
          const json = await response.json()
          const { highlights } = json
          setHighlightRules(Array.isArray(highlights) ? highlights : [])
        }
      } catch (error) {
        console.error('Failed to load highlight rules:', error)
      }
    }
    loadHighlightRules()
  }, [surgeryId])

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

  const handleLinkedSymptomClick = async () => {
    if (!symptom.linkToPage) return

    setIsLoadingLinkedSymptom(true)
    setLinkedSymptomError(null)

    try {
      // Build API URL with surgeryId parameter if available
      let url = `/api/symptoms/by-name?name=${encodeURIComponent(symptom.linkToPage)}`
      if (surgeryId) {
        url += `&surgeryId=${encodeURIComponent(surgeryId)}`
      }

      const response = await fetch(url, { cache: 'no-store' })
      
      if (!response.ok) {
        if (response.status === 404) {
          setLinkedSymptomError(`No symptom found with the name "${symptom.linkToPage}". Please check the spelling or contact your administrator.`)
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
      setIsLoadingLinkedSymptom(false)
    }
  }

  const handleEditInstructions = () => {
    // For practice admins editing base symptoms, start with base content
    // For superusers or when editing overrides/custom, use current content
    const contentToEdit = (isPracticeAdmin && symptom.source === 'base') 
      ? (symptom.instructionsHtml || symptom.instructions || '')
      : (symptom.instructionsHtml || symptom.instructions || '')
    
    setEditedInstructions(contentToEdit)
    setIsEditingInstructions(true)
    setSaveError(null)
  }

  const handleCancelEdit = () => {
    setIsEditingInstructions(false)
    setEditedInstructions('')
    setSaveError(null)
  }

  const handleEditAll = () => {
    setEditedBriefInstruction(symptom.briefInstruction || '')
    setEditedHighlightedText(symptom.highlightedText || '')
    setEditedLinkToPage(symptom.linkToPage || '')
    setEditedInstructions(symptom.instructionsHtml || symptom.instructions || '')
    setIsEditingAll(true)
    setSaveError(null)
  }

  const handleCancelEditAll = () => {
    setIsEditingAll(false)
    setEditedBriefInstruction('')
    setEditedHighlightedText('')
    setEditedLinkToPage('')
    setEditedInstructions('')
    setSaveError(null)
  }

  const handleSaveInstructions = async () => {
    if (!canEditInstructions) return

    setIsSavingInstructions(true)
    setSaveError(null)

    try {
      const sanitizedHtml = sanitizeHtml(editedInstructions)
      
      // Determine the source and surgery ID for the API call
      let apiSource = symptom.source
      let apiSurgeryId = surgeryId
      
      // If practice admin is editing a base symptom, create an override
      if (isPracticeAdmin && symptom.source === 'base') {
        apiSource = 'override'
        apiSurgeryId = surgeryId
      }
      
      const response = await fetch(`/api/admin/symptoms/${symptom.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: apiSource,
          surgeryId: apiSurgeryId,
          instructionsHtml: sanitizedHtml,
          instructions: sanitizedHtml, // Keep legacy field for compatibility
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save instructions')
      }

      // Update the symptom object locally
      symptom.instructionsHtml = sanitizedHtml
      symptom.instructions = sanitizedHtml

      setIsEditingInstructions(false)
      setEditedInstructions('')
      
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
      const sanitizedInstructions = sanitizeHtml(editedInstructions)
      
      // Determine the source and surgery ID for the API call
      let apiSource = symptom.source
      let apiSurgeryId = surgeryId
      
      // If practice admin is editing a base symptom, create an override
      if (isPracticeAdmin && symptom.source === 'base') {
        apiSource = 'override'
        apiSurgeryId = surgeryId
      }
      
      const response = await fetch(`/api/admin/symptoms/${symptom.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: apiSource,
          surgeryId: apiSurgeryId,
          name: symptom.name, // Keep existing name
          ageGroup: symptom.ageGroup, // Keep existing age group
          briefInstruction: editedBriefInstruction.trim(),
          instructions: sanitizedInstructions, // Keep legacy field for compatibility
          instructionsHtml: sanitizedInstructions,
          highlightedText: editedHighlightedText.trim(),
          linkToPage: editedLinkToPage.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save changes')
      }

      // Update the symptom object locally
      symptom.briefInstruction = editedBriefInstruction.trim()
      symptom.highlightedText = editedHighlightedText.trim()
      symptom.linkToPage = editedLinkToPage.trim()
      symptom.instructionsHtml = sanitizedInstructions
      symptom.instructions = sanitizedInstructions
      symptom.source = apiSource // Update source if override was created

      setIsEditingAll(false)
      setEditedBriefInstruction('')
      setEditedHighlightedText('')
      setEditedLinkToPage('')
      setEditedInstructions('')
      
      // Refresh the page to show updated content
      router.refresh()
    } catch (error: any) {
      console.error('Error saving all fields:', error)
      setSaveError(error.message || 'Failed to save changes. Please try again.')
    } finally {
      setIsSavingAll(false)
    }
  }

  return (
    <>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <h1 className="text-3xl font-bold text-nhs-dark-blue">
              {symptom.name}
            </h1>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSourceColor(symptom.source)}`}>
                {symptom.source}
              </span>
              {canEditInstructions && !isEditingAll && !isEditingInstructions && (
                <button
                  onClick={handleEditAll}
                  className="px-4 py-2 text-sm font-medium text-nhs-blue bg-nhs-light-blue border border-nhs-blue rounded-lg hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
                >
                  {isPracticeAdmin && symptom.source === 'base' ? 'Customise All Fields' : 'Edit All Fields'}
                </button>
              )}
            </div>
          </div>
          
          {isEditingAll ? (
            <div className="space-y-4">
              {isPracticeAdmin && symptom.source === 'base' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-700 text-sm">
                    <strong>Customising for your practice:</strong> You're creating a custom version of this symptom for your surgery. The original base symptom will remain unchanged for other practices.
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-nhs-dark-blue mb-2">
                  Brief Instruction
                </label>
                <textarea
                  value={editedBriefInstruction}
                  onChange={(e) => setEditedBriefInstruction(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue"
                  rows={2}
                  placeholder="Enter brief instruction..."
                />
              </div>
            </div>
          ) : (
            <p 
              className="text-lg text-nhs-grey mb-4"
              dangerouslySetInnerHTML={{ 
                __html: highlightText(symptom.briefInstruction || '') 
              }}
            />
          )}
        </div>

        {/* Highlighted Text - Important Notice */}
        {isEditingAll ? (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-nhs-dark-blue mb-2">
                Important Notice (Highlighted Text)
              </label>
              <textarea
                value={editedHighlightedText}
                onChange={(e) => setEditedHighlightedText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue"
                rows={3}
                placeholder="Enter important notice text..."
              />
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

        {/* Main Instructions */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
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
            {canEditInstructions && !isEditingInstructions && !isEditingAll && (
              <button
                onClick={handleEditInstructions}
                className="px-4 py-2 text-sm font-medium text-nhs-blue bg-nhs-light-blue border border-nhs-blue rounded-lg hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
              >
                {isPracticeAdmin && symptom.source === 'base' ? 'Customise Instructions' : 'Edit Instructions'}
              </button>
            )}
          </div>
          
          {isEditingInstructions || isEditingAll ? (
            <div className="space-y-4">
              {isEditingInstructions && isPracticeAdmin && symptom.source === 'base' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-700 text-sm">
                    <strong>Customising for your practice:</strong> You're creating a custom version of these instructions for your surgery. The original base instructions will remain unchanged for other practices.
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-nhs-dark-blue mb-2">
                  Detailed Instructions
                </label>
                <RichTextEditor
                  value={editedInstructions}
                  onChange={setEditedInstructions}
                  placeholder="Enter detailed instructions with formatting..."
                  height={300}
                />
              </div>
              
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
              {(symptom.instructionsHtml || symptom.instructions) ? (
                <div 
                  className="text-nhs-grey leading-relaxed prose-headings:text-nhs-dark-blue prose-a:text-nhs-blue prose-a:underline hover:prose-a:text-nhs-dark-blue prose-strong:text-nhs-dark-blue prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-100 prose-pre:p-4 prose-pre:rounded prose-pre:overflow-x-auto"
                  dangerouslySetInnerHTML={{ 
                    __html: sanitizeAndFormatContent(highlightText(symptom.instructionsHtml || symptom.instructions || ''))
                  }}
                />
              ) : (
                <div className="text-gray-500 italic">
                  No detailed instructions available. Please contact your healthcare provider for guidance.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Link to Page */}
        {isEditingAll ? (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-nhs-dark-blue mb-2">
                Link to Related Symptom
              </label>
              <input
                type="text"
                value={editedLinkToPage}
                onChange={(e) => setEditedLinkToPage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue"
                placeholder="Enter name of related symptom..."
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter the exact name of another symptom to link to. Users will be able to click to navigate to that symptom's instructions.
              </p>
            </div>
          </div>
        ) : (
          symptom.linkToPage && (
            <div className="bg-nhs-light-blue border border-nhs-blue rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-nhs-dark-blue mb-2">
                Related Information
              </h3>
              <p className="text-nhs-grey mb-3">
                For more detailed information about {symptom.linkToPage}, please see:
              </p>
              <button
                onClick={handleLinkedSymptomClick}
                disabled={isLoadingLinkedSymptom}
                className="text-nhs-blue font-medium hover:text-nhs-dark-blue hover:underline focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`View instructions for ${symptom.linkToPage}`}
              >
                {isLoadingLinkedSymptom ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading...
                  </span>
                ) : (
                  `→ ${symptom.linkToPage}`
                )}
              </button>
              
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

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={() => setShowSuggestionModal(true)}
            className="px-6 py-3 bg-nhs-green text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
          >
            Suggest an Improvement
          </button>
          
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 border border-nhs-grey text-nhs-grey rounded-lg hover:bg-nhs-light-grey transition-colors font-medium"
          >
            Back to Symptoms
          </button>
        </div>
      </div>

      <SuggestionModal
        isOpen={showSuggestionModal}
        onClose={() => setShowSuggestionModal(false)}
        symptomId={symptom.id}
        symptomName={symptom.name}
        surgeryId={surgeryId}
      />
    </>
  )
}
