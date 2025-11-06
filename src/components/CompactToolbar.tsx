'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import SurgerySelector from './SurgerySelector'
import SearchBox from './SearchBox'
import AlphabetStrip from './AlphabetStrip'
import AgeFilter from './AgeFilter'
import HighRiskButtons from './HighRiskButtons'
import PasswordChangeModal from './PasswordChangeModal'
import { Surgery } from '@prisma/client'
import { useSession } from 'next-auth/react'
import { useSurgery } from '@/context/SurgeryContext'
import LogoSizeControl from './LogoSizeControl'
import { useCardStyle } from '@/context/CardStyleContext'

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
  const { surgery } = useSurgery()
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const { cardStyle, setCardStyle } = useCardStyle()
  
  // Check if user is a superuser
  const isSuperuser = session?.user && (session.user as any).globalRole === 'SUPERUSER'
  
  // Check if user can access admin features
  const canAccessAdmin = session?.user && (
    isSuperuser ||
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
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <img
                src="/images/signposting_logo_head.png"
                alt="Signposting"
                style={{ height: 'var(--logo-height, 58px)' }}
                className="w-auto"
              />
            </Link>
            <LogoSizeControl />
          </div>

          {/* Surgery Selector and Admin Link */}
          <div className="flex items-center space-x-4">
            {isSuperuser ? (
              // Superusers can change surgery
              showSurgerySelector ? (
                <SurgerySelector 
                  surgeries={surgeries} 
                  currentSurgeryId={surgery?.id || currentSurgeryId}
                  onClose={() => onShowSurgerySelector(false)}
                />
              ) : (
                <button
                  onClick={() => onShowSurgerySelector(true)}
                  className="text-sm text-nhs-blue hover:text-nhs-dark-blue font-medium"
                  aria-label="Change surgery"
                >
                  {surgery ? `You're viewing: ${surgery.name} — Change` : 'Select Surgery'}
                </button>
              )
            ) : (
              // Non-superusers just see their surgery name
              <span className="text-sm text-nhs-grey font-medium">
                {surgery ? surgery.name : 'No surgery selected'}
              </span>
            )}
            
            {canAccessAdmin && (
              <Link 
                href="/admin" 
                className="text-sm text-nhs-grey hover:text-nhs-blue transition-colors"
              >
                Admin
              </Link>
            )}

            {/* Help Link - visible to all authenticated users */}
            <Link 
              href="/help" 
              className="text-sm text-nhs-grey hover:text-nhs-blue transition-colors underline-offset-2 hover:underline"
            >
              User Guide
            </Link>

            {/* Settings Gear Icon */}
            <button
              onClick={() => setShowPasswordModal(true)}
              className="p-2 text-nhs-grey hover:text-nhs-blue transition-colors"
              title="Change Password"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            
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
        <div className="flex items-center gap-4 justify-between">
          {/* Left side: Search Box and Age Filter */}
          <div className="flex items-center gap-4 flex-1">
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
          </div>

          {/* Right side: Display Toggle and Results Count */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Display Toggle */}
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Display:</span>
                <div className="inline-flex rounded-full bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      setCardStyle('default')
                    }}
                    className={`px-3 py-1 text-xs rounded-full transition ${
                      cardStyle === 'default'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500'
                    }`}
                    aria-pressed={cardStyle === 'default'}
                    aria-label="Modern card style"
                  >
                    Modern
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      setCardStyle('powerappsBlue')
                    }}
                    className={`px-3 py-1 text-xs rounded-full transition ${
                      cardStyle === 'powerappsBlue'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500'
                    }`}
                    aria-pressed={cardStyle === 'powerappsBlue'}
                    aria-label="Blue card style"
                  >
                    Blue
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 text-right mt-1">Saved in this browser only.</p>
            </div>

            {/* Results Count */}
            <div className="flex-shrink-0 text-sm text-nhs-grey">
              {resultsCount} of {totalCount}
              {selectedLetter !== 'All' && ` (${selectedLetter})`}
            </div>
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

      {/* Password Change Modal */}
      <PasswordChangeModal 
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  )
}
