'use client'

import { useState, useEffect } from 'react'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import SuggestionModal from './SuggestionModal'
import { applyHighlightRules, HighlightRule } from '@/lib/highlighting'

interface InstructionViewProps {
  symptom: EffectiveSymptom
  surgeryId?: string
}

export default function InstructionView({ symptom, surgeryId }: InstructionViewProps) {
  const [showSuggestionModal, setShowSuggestionModal] = useState(false)
  const [highlightRules, setHighlightRules] = useState<HighlightRule[]>([])

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

  return (
    <>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <h1 className="text-3xl font-bold text-nhs-dark-blue">
              {symptom.name}
            </h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSourceColor(symptom.source)}`}>
              {symptom.source}
            </span>
          </div>
          
          <p 
            className="text-lg text-nhs-grey mb-4"
            dangerouslySetInnerHTML={{ 
              __html: highlightText(symptom.briefInstruction) 
            }}
          />
        </div>

        {/* Highlighted Text - Important Notice */}
        {symptom.highlightedText && (
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
        )}

        {/* Main Instructions */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-nhs-dark-blue mb-4">
            Instructions
          </h2>
          <div className="prose max-w-none">
            {symptom.instructions ? (
              <p 
                className="text-nhs-grey leading-relaxed whitespace-pre-line"
                dangerouslySetInnerHTML={{ 
                  __html: highlightText(symptom.instructions) 
                }}
              />
            ) : (
              <div className="text-gray-500 italic">
                No detailed instructions available. Please contact your healthcare provider for guidance.
              </div>
            )}
          </div>
        </div>

        {/* Link to Page */}
        {symptom.linkToPage && (
          <div className="bg-nhs-light-blue border border-nhs-blue rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-nhs-dark-blue mb-2">
              Related Information
            </h3>
            <p className="text-nhs-grey mb-3">
              For more detailed information about {symptom.linkToPage}, please see:
            </p>
            <div className="text-nhs-blue font-medium">
              → {symptom.linkToPage}
            </div>
          </div>
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
        symptomName={symptom.symptom}
        surgeryId={surgeryId}
      />
    </>
  )
}
