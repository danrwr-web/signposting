"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import SurgerySelector from './SurgerySelector'
import UserPreferencesModal from './UserPreferencesModal'
import { Surgery } from '@prisma/client'
import LogoSizeControl from './LogoSizeControl'
import NavigationTriggerWithTooltip from './NavigationTriggerWithTooltip'
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
  /** Whether to show Daily Dose navigation tabs */
  showDailyDoseNav?: boolean
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
  showDailyDoseNav = false,
}: SimpleHeaderProps) {
  const pathname = usePathname()
  const params = useParams()
  const searchParams = useSearchParams()
  const { surgery: contextSurgery } = useSurgery()
  const { data: session } = useSession()
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

  // Daily Dose navigation logic (only when showDailyDoseNav is true)
  const surgeryId = currentSurgeryId ?? contextSurgery?.id ?? undefined
  const isSuperuser = session?.user && (session.user as any).globalRole === 'SUPERUSER'
  const isAdmin =
    session?.user &&
    (session.user as any).memberships?.some((membership: any) => membership.role === 'ADMIN')

  const withSurgery = (href: string) => (surgeryId ? `${href}?surgery=${surgeryId}` : href)

  const leftNavItems = showDailyDoseNav
    ? [
        { href: '/daily-dose', label: 'Home' },
        { href: '/daily-dose/session', label: 'Session' },
        { href: '/daily-dose/history', label: 'History' },
      ]
    : []

  const rightNavItems = showDailyDoseNav
    ? [
        ...(isSuperuser || isAdmin
          ? [
              { href: '/editorial', label: 'Editorial' },
              { href: '/editorial/library', label: 'Library' },
              { href: '/daily-dose/insights', label: 'Insights' },
            ]
          : []),
        ...(isSuperuser ? [{ href: '/editorial/settings', label: 'Settings' }] : []),
      ]
    : []

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between py-2">
          {/* Left: Logo + Left Nav */}
          <div className="flex flex-col">
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
            {showDailyDoseNav && leftNavItems.length > 0 && (
              <nav aria-label="Daily Dose navigation" className="mt-1 flex gap-2">
                {leftNavItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  return (
                    <Link
                      key={item.href}
                      href={withSurgery(item.href)}
                      className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                        active ? 'bg-nhs-blue text-white' : 'text-slate-600 hover:text-nhs-dark-blue'
                      }`}
                      aria-current={active ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            )}
          </div>

          {/* Right: Surgery Selector + Right Nav */}
          <div className="flex flex-col items-end">
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
            {showDailyDoseNav && rightNavItems.length > 0 && (
              <nav aria-label="Editorial navigation" className="mt-1 flex gap-2">
                {rightNavItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  return (
                    <Link
                      key={item.href}
                      href={withSurgery(item.href)}
                      className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                        active ? 'bg-nhs-blue text-white' : 'text-slate-600 hover:text-nhs-dark-blue'
                      }`}
                      aria-current={active ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            )}
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
