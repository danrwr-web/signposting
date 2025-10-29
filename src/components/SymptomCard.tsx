'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import { applyHighlightRules, HighlightRule } from '@/lib/highlighting'
import { useSurgery } from '@/context/SurgeryContext'

interface SymptomCardProps {
  symptom: EffectiveSymptom
  surgerySlug?: string
}

export default function SymptomCard({ symptom, surgerySlug }: SymptomCardProps) {
  const { currentSurgerySlug } = useSurgery()
  const [highlightRules, setHighlightRules] = useState<HighlightRule[]>([])
  const [enableBuiltInHighlights, setEnableBuiltInHighlights] = useState<boolean>(true)
  const [enableImageIcons, setEnableImageIcons] = useState<boolean>(true)
  const [imageIcon, setImageIcon] = useState<{ imageUrl: string; cardSize: string } | null>(null)

  // Use provided surgerySlug or fall back to context
  const effectiveSurgerySlug = surgerySlug || currentSurgerySlug


  // Load highlight rules and image icon from combined API endpoint
  useEffect(() => {
    const loadCardData = async () => {
      try {
        // Build URL with surgeryId and phrase for combined data fetch
        let url = '/api/symptom-card-data'
        const params = new URLSearchParams()
        if (effectiveSurgerySlug) {
          params.append('surgeryId', effectiveSurgerySlug)
        }
        if (symptom.briefInstruction) {
          params.append('phrase', symptom.briefInstruction)
        }
        if (params.toString()) {
          url += `?${params.toString()}`
        }
        
        // Single API call for all card data - uses caching
        const response = await fetch(url)
        if (response.ok) {
          const json = await response.json()
          const { 
            highlights, 
            enableBuiltInHighlights: builtInEnabled, 
            enableImageIcons: imageIconsEnabled,
            imageIcon: iconData
          } = json
          
          setHighlightRules(Array.isArray(highlights) ? highlights : [])
          setEnableBuiltInHighlights(builtInEnabled ?? true)
          setEnableImageIcons(imageIconsEnabled ?? true)
          
          // Set image icon if available
          if (iconData && iconData.imageUrl) {
            setImageIcon({ 
              imageUrl: iconData.imageUrl, 
              cardSize: iconData.cardSize || 'medium' 
            })
          } else {
            setImageIcon(null)
          }
        } else {
          console.error('SymptomCard: Failed to fetch card data:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('Failed to load card data:', error)
      }
    }
    loadCardData()
  }, [effectiveSurgerySlug, symptom.briefInstruction])

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

  const getAgeGroupColor = (ageGroup: string) => {
    switch (ageGroup) {
      case 'U5':
        return 'bg-blue-100 text-blue-800'
      case 'O5':
        return 'bg-green-100 text-green-800'
      case 'Adult':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getAgeGroupLabel = (ageGroup: string) => {
    switch (ageGroup) {
      case 'U5':
        return 'Under 5'
      case 'O5':
        return '5-17'
      case 'Adult':
        return 'Adult'
      default:
        return ageGroup
    }
  }

  const highlightText = (text: string) => {
    return applyHighlightRules(text, highlightRules, enableBuiltInHighlights)
  }

  const linkUrl = `/symptom/${symptom.id || 'unknown'}${effectiveSurgerySlug ? `?surgery=${effectiveSurgerySlug}` : ''}`

  return (
    <Link href={linkUrl}>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 p-4 cursor-pointer border border-gray-200 h-full flex flex-col group">
        {/* Header with title and badges */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1">
            <h3 className="text-base font-semibold text-nhs-dark-blue leading-tight pr-2">
              {symptom.name || 'Unknown Symptom'}
            </h3>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAgeGroupColor(symptom.ageGroup || 'Adult')}`}>
              {getAgeGroupLabel(symptom.ageGroup || 'Adult')}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSourceColor(symptom.source || 'base')}`}>
              {symptom.source === 'override' ? 'Practice Customised' : 
               symptom.source === 'custom' ? 'Practice Created' : 
               symptom.source || 'base'}
            </span>
          </div>
        </div>
        
        {/* Brief instruction - truncated */}
        <div className="flex-1 mb-3">
          <p 
            className="text-nhs-grey text-sm leading-relaxed line-clamp-3"
            dangerouslySetInnerHTML={{ 
              __html: highlightText(symptom.briefInstruction || "") 
            }}
          />
        </div>
        
        {/* Highlight preview - compact */}
        {symptom.highlightedText && (
          <div className="bg-red-50 border-l-2 border-nhs-red p-2 mb-3 rounded-r">
            <p 
              className="text-xs font-medium text-nhs-red line-clamp-2"
              dangerouslySetInnerHTML={{ 
                __html: highlightText(symptom.highlightedText || "") 
              }}
            />
          </div>
        )}
        
        {/* Footer with link and open affordance */}
        <div className="flex items-center justify-between mt-auto">
          {symptom.linkToPage && (
            <div className="text-xs text-nhs-blue font-medium truncate flex-1">
              → {symptom.linkToPage}
            </div>
          )}
          <div className="flex items-center gap-2">
            {imageIcon && enableImageIcons && (() => {
              // Map size to Tailwind classes
              const sizeClasses = {
                small: 'w-16 h-16',
                medium: 'w-24 h-24',
                large: 'w-32 h-32'
              }
              const sizeClass = sizeClasses[imageIcon.cardSize as keyof typeof sizeClasses] || sizeClasses.medium
              
              return (
                <div className={`relative ${sizeClass} flex-shrink-0`}>
                  <Image
                    src={imageIcon.imageUrl}
                    alt=""
                    fill
                    className="object-contain"
                  />
                </div>
              )
            })()}
            <div className="text-xs text-nhs-blue font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Open →
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
