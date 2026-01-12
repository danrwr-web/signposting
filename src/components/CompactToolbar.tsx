'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import SurgerySelector from './SurgerySelector'
import SurgeryFiltersHeader from './SurgeryFiltersHeader'
import UserPreferencesModal from './UserPreferencesModal'
import { Surgery } from '@prisma/client'
import { useSession } from 'next-auth/react'
import { useSurgery } from '@/context/SurgeryContext'
import LogoSizeControl from './LogoSizeControl'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'

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
  workflowGuidanceEnabled?: boolean
  symptoms?: EffectiveSymptom[]
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
  onShowSurgerySelector,
  workflowGuidanceEnabled,
  symptoms,
}: CompactToolbarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname() || ''
  const params = useParams()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { surgery } = useSurgery()
  const [showPreferencesModal, setShowPreferencesModal] = useState(false)
  
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

  // `params.id` is ambiguous: it is the surgery id on `/s/[id]/...`, but it is the symptom id on `/symptom/[id]`.
  // Use the pathname to decide which value is safe to treat as a surgery id.
  const surgeryId =
    pathname.startsWith('/s/')
      ? ((params as Record<string, string | string[] | undefined>)?.id as string | undefined)
      : pathname.startsWith('/symptom/')
        ? (searchParams.get('surgery') || undefined)
        : (currentSurgeryId ?? surgery?.id)

  const logoHref = surgeryId ? `/s/${surgeryId}` : '/s'

  return (
    <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
      {/* Row 1: Logo, Surgery Selector, Admin Link */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center">
            <Link href={logoHref} className="flex items-center">
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

            {/* Appointment Directory Link - visible to all logged-in surgery users */}
            {currentSurgeryId && (
              <Link
                href={`/s/${currentSurgeryId}/appointments`}
                className="text-sm font-medium text-slate-700 hover:text-sky-700"
              >
                Appointment Directory
              </Link>
            )}

            {/* Workflow Guidance Link - only when enabled for this surgery */}
            {currentSurgeryId && workflowGuidanceEnabled && (
              <Link
                href={`/s/${currentSurgeryId}/workflow`}
                className="text-sm font-medium text-slate-700 hover:text-sky-700"
              >
                Workflow guidance
              </Link>
            )}

            {/* Documentation Link - admin and superuser only */}
            {canAccessAdmin && (
              <a
                href="https://docs.signpostingtool.co.uk/"
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm text-nhs-grey hover:text-nhs-blue transition-colors underline-offset-2 hover:underline"
              >
                Docs
              </a>
            )}

            {/* Settings Gear Icon */}
            <button
              onClick={() => setShowPreferencesModal(true)}
              className="p-2 text-nhs-grey hover:text-nhs-blue transition-colors"
              title="Open preferences"
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

      <SurgeryFiltersHeader
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        selectedLetter={selectedLetter}
        onLetterChange={onLetterChange}
        selectedAge={selectedAge}
        onAgeChange={onAgeChange}
        resultsCount={resultsCount}
        totalCount={totalCount}
        currentSurgeryId={currentSurgeryId}
        searchInputRef={searchInputRef}
        symptoms={symptoms}
      />

      {/* User Preferences Modal */}
      <UserPreferencesModal 
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
      />
    </div>
  )
}
