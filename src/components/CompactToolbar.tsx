'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import SurgerySelector from './SurgerySelector'
import SearchBox from './SearchBox'
import AlphabetStrip from './AlphabetStrip'
import AgeFilter from './AgeFilter'
import HighRiskButtons from './HighRiskButtons'
import { Surgery } from '@prisma/client'
import { useSession } from 'next-auth/react'

type Letter = 'All' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
type AgeBand = 'All' | 'Under5' | '5to17' | 'Adult'

interface CompactToolbarProps {
  surgeries: Surgery[]
  currentSurgeryId?: string
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedLetter: Letter
  onLetterChange: (letter: Letter) => void
  selectedAge: AgeBand
  onAgeChange: (age: AgeBand) => void
  resultsCount: number
  totalCount: number
  showSurgerySelector: boolean
  onShowSurgerySelector: (show: boolean) => void
}

export default function CompactToolbar({
  surgeries,
  currentSurgeryId,
  searchTerm,
  onSearchChange,
  selectedLetter,
  onLetterChange,
  selectedAge,
  onAgeChange,
  resultsCount,
  totalCount,
  showSurgerySelector,
  onShowSurgerySelector
}: CompactToolbarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { data: session } = useSession()
  
  // Check if user can access admin features
  const canAccessAdmin = session?.user && (
    (session.user as any).globalRole === 'SUPERUSER' ||
    (session.user as any).memberships?.some((m: any) => m.role === 'ADMIN')
  )

  const handleLogout = async () => {
    try {
      await signOut({ callbackUrl: '/' })
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Keyboard shortcuts: / to focus search, Esc to clear
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      if (event.key === '/') {
        event.preventDefault()
        searchInputRef.current?.focus()
      } else if (event.key === 'Escape') {
        onSearchChange('')
        onLetterChange('All')
        onAgeChange('All')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onSearchChange, onLetterChange, onAgeChange])

  return (
    <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
      {/* Row 1: Logo, Surgery Selector, Admin Link */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo and Title */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-nhs-blue rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xs">NHS</span>
              </div>
              <h1 className="text-lg font-bold text-nhs-dark-blue">
                Signposting
              </h1>
            </Link>
          </div>

          {/* Surgery Selector and Admin Link */}
          <div className="flex items-center space-x-4">
            {showSurgerySelector ? (
              <SurgerySelector 
                surgeries={surgeries} 
                currentSurgeryId={currentSurgeryId}
                onClose={() => onShowSurgerySelector(false)}
              />
            ) : (
              <button
                onClick={() => onShowSurgerySelector(true)}
                className="text-sm text-nhs-blue hover:text-nhs-dark-blue font-medium"
                aria-label="Select surgery"
              >
                Select Surgery
              </button>
            )}
            
            {canAccessAdmin && (
              <Link 
                href="/admin" 
                className="text-sm text-nhs-grey hover:text-nhs-blue transition-colors"
              >
                Admin
              </Link>
            )}
            
            <button
              onClick={handleLogout}
              className="text-sm text-nhs-grey hover:text-nhs-blue transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Search, Age Filter, Results Count */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3">
        <div className="flex items-center gap-4">
          {/* Search Box */}
          <div className="flex-1 max-w-md">
            <SearchBox 
              ref={searchInputRef}
              value={searchTerm}
              onChange={onSearchChange}
              placeholder="Search symptoms... (Press / to focus)"
              debounceMs={250}
            />
          </div>

          {/* Age Filter */}
          <div className="flex-shrink-0">
            <AgeFilter 
              value={selectedAge}
              onChange={onAgeChange}
            />
          </div>

          {/* Results Count */}
          <div className="flex-shrink-0 text-sm text-nhs-grey">
            {resultsCount} of {totalCount}
            {selectedLetter !== 'All' && ` (${selectedLetter})`}
          </div>
        </div>
      </div>

      {/* Row 3: High-Risk Buttons (scrollable) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 pb-2 min-w-max">
            <HighRiskButtons surgeryId={currentSurgeryId} />
          </div>
        </div>
      </div>

      {/* Row 4: Alphabet Strip (scrollable) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="min-w-max">
            <AlphabetStrip 
              selected={selectedLetter} 
              onSelect={onLetterChange}
              size="sm"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
