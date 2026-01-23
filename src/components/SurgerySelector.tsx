'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Surgery } from '@prisma/client'
import { useSurgery } from '@/context/SurgeryContext'
import { useSession } from 'next-auth/react'

interface SurgerySelectorProps {
  surgeries: Surgery[]
  currentSurgeryId?: string
  onClose?: () => void
}

export default function SurgerySelector({ surgeries, currentSurgeryId, onClose }: SurgerySelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { clearSurgery, surgery } = useSurgery()
  const { data: session } = useSession()
  // Use surgery from context as source of truth, fallback to currentSurgeryId prop
  const actualSurgeryId = surgery?.id || currentSurgeryId || ''
  const [selectedId, setSelectedId] = useState(actualSurgeryId)
  const selectRef = useRef<HTMLSelectElement>(null)
  
  // Check if user is a superuser
  const isSuperuser = session?.user && (session.user as any).globalRole === 'SUPERUSER'

  // Sync selectedId with context surgery when it changes
  useEffect(() => {
    const newId = surgery?.id || currentSurgeryId || ''
    setSelectedId(newId)
  }, [surgery?.id, currentSurgeryId])

  // Focus management for accessibility
  useEffect(() => {
    if (selectRef.current) {
      selectRef.current.focus()
    }
  }, [])

  const handleSurgeryChange = (surgeryId: string) => {
    if (!surgeryId) {
      clearSurgery()
      onClose?.()
      return
    }

    const selectedSurgery = surgeries.find(s => s.id === surgeryId)
    if (!selectedSurgery) {
      onClose?.()
      return
    }

    // Update local state immediately for responsive UI
    setSelectedId(surgeryId)

    // Write to cookie/localStorage for persistence (without triggering context navigation)
    if (typeof document !== 'undefined') {
      document.cookie = `surgery=${encodeURIComponent(surgeryId)}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax`
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('surgery_state', JSON.stringify({
        id: selectedSurgery.id,
        name: selectedSurgery.name,
        slug: selectedSurgery.slug || selectedSurgery.id
      }))
    }

    // Navigate to the same page but for the new surgery
    // Use safe path matching to avoid navigating to surgery-specific item pages
    const newPath = getSafePathForSurgery(pathname, surgeryId)
    
    router.push(newPath)
    onClose?.()
  }

  /**
   * Determines a safe path to navigate to when switching surgeries.
   * 
   * Some paths contain surgery-specific IDs (e.g., workflow template IDs, handbook item IDs)
   * that won't exist in another surgery. This function finds the nearest "safe" parent path.
   * 
   * Safe paths are routes that exist for all surgeries (e.g., /workflow, /admin-toolkit).
   * Unsafe paths contain dynamic IDs that are surgery-specific.
   */
  function getSafePathForSurgery(currentPath: string | null, newSurgeryId: string): string {
    const basePath = `/s/${newSurgeryId}`
    
    if (!currentPath || !currentPath.startsWith('/s/')) {
      return basePath
    }

    // Extract the path after /s/[surgeryId]
    const pathParts = currentPath.split('/')
    // pathParts = ['', 's', 'surgery-id', 'workflow', 'templates', 'abc123', 'view']
    if (pathParts.length <= 3) {
      return basePath
    }

    const remainingParts = pathParts.slice(3) // ['workflow', 'templates', 'abc123', 'view']

    // Define safe route patterns (paths that exist for all surgeries)
    // These are the "list" or "landing" pages, not item-specific pages
    const safePatterns = [
      // Exact matches - these paths are always safe
      'workflow',
      'workflow/templates',
      'workflow/start',
      'workflow/admin',
      'workflow/admin/styles',
      'admin-toolkit',
      'admin-toolkit/admin',
      'appointments',
      'clinical-review',
      'admin',
      'admin/users',
      'admin/ai-setup',
      'admin/onboarding',
    ]

    // Build the remaining path and find the longest safe prefix
    let safePath = ''
    let currentCheck = ''
    
    for (const part of remainingParts) {
      const nextCheck = currentCheck ? `${currentCheck}/${part}` : part
      
      // Check if this path is in our safe patterns
      if (safePatterns.includes(nextCheck)) {
        safePath = nextCheck
        currentCheck = nextCheck
      } else {
        // This part might be a dynamic ID - stop here
        break
      }
    }

    return safePath ? `${basePath}/${safePath}` : basePath
  }

  // If not superuser, just show the surgery name
  if (!isSuperuser) {
    const currentSurgery = surgery || surgeries.find(s => s.id === currentSurgeryId)
    return (
      <div className="flex items-center">
        <span className="text-sm font-medium text-nhs-grey">
          {currentSurgery ? currentSurgery.name : 'No surgery selected'}
        </span>
      </div>
    )
  }

  // For superusers, show the dropdown
  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="surgery-select" className="text-sm font-medium text-nhs-grey">
        You’re viewing:
      </label>
      <select
        ref={selectRef}
        id="surgery-select"
        value={selectedId}
        onChange={(e) => handleSurgeryChange(e.target.value)}
        className="px-3 py-1 border border-nhs-grey rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
        aria-label="Change surgery"
      >
        <option value="">Select Surgery</option>
        {surgeries.map((surgery) => (
          <option key={surgery.id} value={surgery.id}>
            {surgery.name}
          </option>
        ))}
      </select>
      {onClose && (
        <button
          onClick={onClose}
          className="text-sm text-nhs-grey hover:text-nhs-blue"
          aria-label="Close surgery selector"
        >
          ×
        </button>
      )}
    </div>
  )
}
