'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { GetHighRiskResZ } from '@/lib/api-contracts'

interface HighRiskLink {
  id: string
  label: string
  symptomSlug: string | null
  symptomId: string | null
  orderIndex: number
}

interface HighRiskButtonsProps {
  surgeryId?: string
  className?: string
  variant?: 'classic' | 'split'
}

export default function HighRiskButtons({ surgeryId, className, variant = 'classic' }: HighRiskButtonsProps) {
  const [highRiskLinks, setHighRiskLinks] = useState<HighRiskLink[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadHighRiskLinks()
  }, [surgeryId])

  const loadHighRiskLinks = async () => {
    try {
      setIsLoading(true)
      const url = surgeryId ? `/api/highrisk?surgery=${surgeryId}` : '/api/highrisk'
      // Use cached response - API sets appropriate cache headers
      const res = await fetch(url)
      
      if (!res.ok) {
        throw new Error(`HighRisk fetch failed: ${res.status}`)
      }
      
      const json = await res.json()
      const { links } = GetHighRiskResZ.parse(json)
      
      if (Array.isArray(links) && links.length > 0) {
        setHighRiskLinks(links.filter(link => link.symptomSlug !== undefined) as any)
      } else {
        // Fallback to default buttons if no configuration exists
        setHighRiskLinks([
          { id: 'default-1', label: 'Anaphylaxis', symptomSlug: 'anaphylaxis', symptomId: null, orderIndex: 0 },
          { id: 'default-2', label: 'Stroke', symptomSlug: 'stroke', symptomId: null, orderIndex: 1 },
          { id: 'default-3', label: 'Chest Pain', symptomSlug: 'chest-pain', symptomId: null, orderIndex: 2 },
          { id: 'default-4', label: 'Sepsis', symptomSlug: 'sepsis', symptomId: null, orderIndex: 3 },
          { id: 'default-5', label: 'Meningitis Rash', symptomSlug: 'meningitis', symptomId: null, orderIndex: 4 }
        ])
      }
    } catch (error) {
      console.error('Error loading high-risk links:', error)
      // Fallback to default buttons
      setHighRiskLinks([
        { id: 'default-1', label: 'Anaphylaxis', symptomSlug: 'anaphylaxis', symptomId: null, orderIndex: 0 },
        { id: 'default-2', label: 'Stroke', symptomSlug: 'stroke', symptomId: null, orderIndex: 1 },
        { id: 'default-3', label: 'Chest Pain', symptomSlug: 'chest-pain', symptomId: null, orderIndex: 2 },
        { id: 'default-4', label: 'Sepsis', symptomSlug: 'sepsis', symptomId: null, orderIndex: 3 },
        { id: 'default-5', label: 'Meningitis Rash', symptomSlug: 'meningitis', symptomId: null, orderIndex: 4 }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const baseClasses =
    variant === 'split'
      ? 'grid grid-cols-1 lg:grid-cols-2 gap-2'
      : 'flex gap-3'
  const containerClasses = [baseClasses, className].filter(Boolean).join(' ')

  const buttonClasses =
    variant === 'split'
      ? 'w-full inline-flex h-11 items-center rounded-full bg-red-600 text-white font-semibold px-5 border-2 border-red-700 hover:bg-red-700 transition-colors shadow-sm hover:shadow-md text-sm text-left focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
      : 'inline-flex h-11 items-center rounded-full bg-red-600 text-white font-semibold px-5 border-2 border-red-700 hover:bg-red-700 transition-colors shadow-sm hover:shadow-md text-sm whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'

  if (isLoading) {
    return (
      <div className={containerClasses} aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="w-full px-4 py-2 bg-gray-200 rounded-full animate-pulse"
          >
            <span className="text-gray-400 text-sm">Loading...</span>
          </div>
        ))}
      </div>
    )
  }

  if (highRiskLinks.length === 0) {
    return null
  }

  return (
    <div className={containerClasses}>
      {highRiskLinks
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((link) => {
          // Build href based on configured symptom slug or ID
          let href = '#'
          if (link.symptomId) {
            href = `/symptom/${link.symptomId}${surgeryId ? `?surgery=${surgeryId}` : ''}`
          } else if (link.symptomSlug) {
            // For slug-based links, we'll need to resolve to ID on the server side
            // For now, use the slug directly - the symptom page should handle this
            href = `/symptom/${link.symptomSlug}${surgeryId ? `?surgery=${surgeryId}` : ''}`
          }

          return (
            <Link key={link.id} href={href} className="w-full">
              <button
                className={buttonClasses}
                title={`View ${link.label}`}
                aria-label={`View ${link.label} symptom information`}
              >
                {link.label}
              </button>
            </Link>
          )
        })}
    </div>
  )
}
