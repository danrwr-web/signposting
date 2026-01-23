"use client"

import Link from 'next/link'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import SurgerySelector from './SurgerySelector'
import { Surgery } from '@prisma/client'
import LogoSizeControl from './LogoSizeControl'
import NavigationPanelTrigger from './NavigationPanelTrigger'
import { useSurgery } from '@/context/SurgeryContext'

interface SimpleHeaderProps {
  /** Optional list of surgeries for the dropdown selector */
  surgeries?: Surgery[]
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
            <NavigationPanelTrigger className="mr-3" />
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

          {/* Surgery Selector or Name Display */}
          <div className="flex items-center">
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
          </div>
        </div>
      </div>
    </header>
  )
}
