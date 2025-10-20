/**
 * Custom hook for surgery slug conversion and API URL building
 */

import { useMemo } from 'react'

interface Surgery {
  id: string
  slug: string
  name: string
}

interface UseSurgerySlugProps {
  surgeryId?: string
  surgeries?: Surgery[]
}

export function useSurgerySlug({ surgeryId, surgeries }: UseSurgerySlugProps) {
  const surgerySlug = useMemo(() => {
    if (!surgeryId || !surgeries) return surgeryId
    
    const surgery = surgeries.find(s => s.id === surgeryId)
    return surgery?.slug || surgeryId
  }, [surgeryId, surgeries])

  const buildApiUrl = (endpoint: string, includeSurgery = true) => {
    const baseUrl = `/api/admin/${endpoint}`
    if (includeSurgery && surgerySlug) {
      return `${baseUrl}?surgery=${surgerySlug}`
    }
    return baseUrl
  }

  return {
    surgerySlug,
    buildApiUrl
  }
}
