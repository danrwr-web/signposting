"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import SurgerySelector from './SurgerySelector'
import UserPreferencesModal from './UserPreferencesModal'
import LogoSizeControl from './LogoSizeControl'
import NavigationTriggerWithTooltip from './NavigationTriggerWithTooltip'
import { useSurgery } from '@/context/SurgeryContext'

interface SimpleHeaderProps {
  /** Optional list of surgeries for the dropdown selector */
  surgeries?: Array<{ id: string; slug: string | null; name: string }>
  /** Current surgery ID (used with surgeries prop) */
  currentSurgeryId?: string
  /** Surgery name to display (alternative to surgeries prop) */
  surgeryName?: string
  /** Surgery ID for logo link (used with surgeryName prop) */
  surgeryId?: string
}

/**
 * Universal app header used across all modules.
 * Shows: hamburger menu, logo, and surgery name/selector.
 */
export default function SimpleHeader({
  surgeries,
  currentSurgeryId,
  surgeryName,
  surgeryId: propSurgeryId,
}: SimpleHeaderProps) {
  const pathname = usePathname()
  const params = useParams()
  const searchParams = useSearchParams()
  const { surgery: contextSurgery } = useSurgery()
  const [showPreferencesModal, setShowPreferencesModal] = useState(false)

  // Determine surgery ID from props, URL params, or context
  const surgeryIdFromUrl =
    pathname.startsWith('/s/')
      ? ((params as Record<string, string | string[] | undefined>)?.id as string | undefined)
      : pathname.startsWith('/symptom/')
        ? (searchParams.get('surgery') || undefined)
        : undefined

  const effectiveSurgeryId = propSurgeryId || surgeryIdFromUrl || currentSurgeryId || contextSurgery?.id
  const effectiveSurgeryName = surgeryName || contextSurgery?.name

  const logoHref = effectiveSurgeryId ? `/s/${effectiveSurgeryId}` : '/s'

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Navigation Trigger + Logo */}
          <div className="flex items-center">
            <NavigationTriggerWithTooltip className="mr-3" />
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

          {/* Surgery Selector or Name Display + Preferences */}
          <div className="flex items-center gap-3">
            {surgeries && surgeries.length > 0 ? (
              <SurgerySelector 
                surgeries={surgeries} 
                currentSurgeryId={currentSurgeryId}
              />
            ) : effectiveSurgeryName ? (
              <span className="text-sm text-nhs-grey font-medium">
                {effectiveSurgeryName}
              </span>
            ) : null}

            {/* Settings Gear Icon - personal preferences */}
            <button
              onClick={() => setShowPreferencesModal(true)}
              className="p-2 text-nhs-grey hover:text-nhs-blue transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
              title="Preferences"
              aria-label="Open preferences"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* User Preferences Modal */}
      <UserPreferencesModal 
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
      />
    </header>
  )
}
