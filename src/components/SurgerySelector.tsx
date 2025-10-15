'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Surgery } from '@prisma/client'

interface SurgerySelectorProps {
  surgeries: Surgery[]
  currentSurgerySlug?: string
}

export default function SurgerySelector({ surgeries, currentSurgerySlug }: SurgerySelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedSlug, setSelectedSlug] = useState(currentSurgerySlug || '')

  useEffect(() => {
    setSelectedSlug(currentSurgerySlug || '')
  }, [currentSurgerySlug])

  const handleSurgeryChange = (slug: string) => {
    setSelectedSlug(slug)
    
    // Update URL parameter
    const params = new URLSearchParams(searchParams.toString())
    if (slug) {
      params.set('surgery', slug)
    } else {
      params.delete('surgery')
    }
    
    // Update cookie
    document.cookie = `surgerySlug=${slug}; path=/; max-age=${60 * 60 * 24 * 30}` // 30 days
    
    // Navigate with new params
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    router.push(newUrl)
  }

  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="surgery-select" className="text-sm font-medium text-nhs-grey">
        Surgery:
      </label>
      <select
        id="surgery-select"
        value={selectedSlug}
        onChange={(e) => handleSurgeryChange(e.target.value)}
        className="px-3 py-1 border border-nhs-grey rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
      >
        <option value="">Select Surgery</option>
        {surgeries.map((surgery) => (
          <option key={surgery.id} value={surgery.slug}>
            {surgery.name}
          </option>
        ))}
      </select>
    </div>
  )
}
