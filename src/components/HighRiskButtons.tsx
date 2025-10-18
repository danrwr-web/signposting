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
}

export default function HighRiskButtons({ surgeryId }: HighRiskButtonsProps) {
  const [highRiskLinks, setHighRiskLinks] = useState<HighRiskLink[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadHighRiskLinks()
  }, [surgeryId])

  const loadHighRiskLinks = async () => {
    try {
      setIsLoading(true)
      const url = surgeryId ? `/api/highrisk?surgery=${surgeryId}` : '/api/highrisk'
      const res = await fetch(url, { cache: 'no-store' })
      
      if (!res.ok) {
        throw new Error(`HighRisk fetch failed: ${res.status}`)
      }
      
      const json = await res.json()
      const { links } = GetHighRiskResZ.parse(json)
      
      if (Array.isArray(links) && links.length > 0) {
        setHighRiskLinks(links)
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

  if (isLoading) {
    return (
      <>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="px-4 py-2 bg-gray-200 rounded-full animate-pulse"
          >
            <span className="text-gray-400 text-sm">Loading...</span>
          </div>
        ))}
      </>
    )
  }

  if (highRiskLinks.length === 0) {
    return null
  }

  return (
    <>
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
            <Link key={link.id} href={href}>
              <button
                className="px-4 py-2 bg-red-600 text-white font-semibold rounded-full border-2 border-red-700 hover:bg-red-700 transition-colors shadow-sm hover:shadow-md text-sm whitespace-nowrap"
                title={`View ${link.label}`}
              >
                {link.label}
              </button>
            </Link>
          )
        })}
    </>
  )
}
