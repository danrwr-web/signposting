'use client'

import { useState, useEffect, useRef } from 'react'
import { Surgery } from '@prisma/client'
import { useSurgery } from '@/context/SurgeryContext'

interface SurgerySelectorProps {
  surgeries: Surgery[]
  currentSurgeryId?: string
  onClose?: () => void
}

export default function SurgerySelector({ surgeries, currentSurgeryId, onClose }: SurgerySelectorProps) {
  const { setSurgery, clearSurgery } = useSurgery()
  const [selectedId, setSelectedId] = useState(currentSurgeryId || '')
  const selectRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    setSelectedId(currentSurgeryId || '')
  }, [currentSurgeryId])

  // Focus management for accessibility
  useEffect(() => {
    if (selectRef.current) {
      selectRef.current.focus()
    }
  }, [])

  const handleSurgeryChange = (surgeryId: string) => {
    setSelectedId(surgeryId)
    
    if (surgeryId) {
      const surgery = surgeries.find(s => s.id === surgeryId)
      if (surgery) {
        setSurgery({ id: surgery.id, name: surgery.name })
      }
    } else {
      clearSurgery()
    }
    
    onClose?.()
  }

  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="surgery-select" className="text-sm font-medium text-nhs-grey">
        You're viewing:
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
