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
    // Replace the surgery ID in the current path: /s/[oldId]/... -> /s/[newId]/...
    let newPath = `/s/${surgeryId}`
    if (pathname && pathname.startsWith('/s/')) {
      // Extract the path after /s/[surgeryId]
      const pathParts = pathname.split('/')
      // pathParts = ['', 's', 'surgery-id', 'workflow', ...]
      if (pathParts.length > 3) {
        // Keep everything after the surgery ID
        const remainingPath = pathParts.slice(3).join('/')
        newPath = `/s/${surgeryId}/${remainingPath}`
      }
    }
    
    router.push(newPath)
    onClose?.()
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
