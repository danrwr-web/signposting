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
  appearance?: 'pill' | 'tile'
}

export default function HighRiskButtons({ surgeryId, className, variant = 'classic', appearance = 'pill' }: HighRiskButtonsProps) {
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

  const isSplit = variant === 'split'
  const baseClasses =
    isSplit
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-2'
      : 'flex gap-3'
  const containerClasses = [baseClasses, className].filter(Boolean).join(' ')

  const sectionHeader = (
    <div className="flex items-center gap-2 mb-2">
      <svg className="w-4 h-4 text-nhs-red flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <span className="text-xs font-semibold uppercase tracking-wider text-nhs-red">Urgent</span>
    </div>
  )

  if (isLoading) {
    return (
      <div className="bg-red-50/60 border border-red-100 rounded-xl px-3 py-3">
        {sectionHeader}
        <div className={containerClasses} aria-hidden="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="w-full h-11 bg-red-100/60 rounded-full animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (highRiskLinks.length === 0) {
    return null
  }

  return (
    <div className="bg-red-50/60 border border-red-100 rounded-xl px-3 py-3">
      {sectionHeader}
      <div className={containerClasses}>
        {highRiskLinks
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((link) => {
            // Build href based on configured symptom slug or ID
            let href = '#'
            if (link.symptomId) {
              href = `/symptom/${link.symptomId}${surgeryId ? `?surgery=${surgeryId}` : ''}`
            } else if (link.symptomSlug) {
              href = `/symptom/${link.symptomSlug}${surgeryId ? `?surgery=${surgeryId}` : ''}`
            }

            const baseButtonClasses = appearance === 'tile'
              ? 'w-full h-11 rounded-xl border border-red-200 bg-white text-red-900 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-red-300 shadow-sm'
              : 'w-full h-11 rounded-full bg-nhs-red text-white hover:bg-[#cc2a2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-red-300 shadow-sm'

            const fontFor = (label: string) => {
              const n = label.trim().length
              if (n > 22) return 'text-[12px]'
              if (n > 18) return 'text-[13px]'
              if (n > 14) return 'text-[14px]'
              return 'text-[15px]'
            }

            const buttonClasses = [
              baseButtonClasses,
              'inline-flex items-center justify-center px-4 leading-none font-medium whitespace-nowrap'
            ].filter(Boolean).join(' ')

            return (
              <Link key={link.id} href={href} className="w-full">
                <button
                  className={buttonClasses}
                  title={link.label}
                  aria-label={link.label}
                >
                  <span className={['tracking-tight', fontFor(link.label)].filter(Boolean).join(' ')}>
                    {link.label}
                  </span>
                </button>
              </Link>
            )
          })}
      </div>
    </div>
  )
}
