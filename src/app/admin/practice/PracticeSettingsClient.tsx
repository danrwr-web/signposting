'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import SimpleHeader from '@/components/SimpleHeader'

interface Surgery {
  id: string
  name: string
  slug: string | null
  _count: {
    users: number
  }
}

interface PracticeSettingsClientProps {
  surgeries: Surgery[]
  primarySurgeryId: string | null
  isSuperuser: boolean
  enabledFeatures: Record<string, boolean>
}

interface SettingsCard {
  id: string
  title: string
  description: string
  href: string
  icon: React.ReactNode
  stats?: string
  badge?: number
  requiresFeature?: string
}

interface SetupChecklistData {
  onboardingCompleted: boolean
  appointmentModelConfigured: boolean
  aiCustomisationOccurred: boolean
  pendingCount: number
  setupChecklistOutstandingCount: number
}

export default function PracticeSettingsClient({
  surgeries,
  primarySurgeryId,
  isSuperuser,
  enabledFeatures,
}: PracticeSettingsClientProps) {
  const [selectedSurgeryId, setSelectedSurgeryId] = useState<string>(
    primarySurgeryId || surgeries[0]?.id || ''
  )
  const [setupChecklistData, setSetupChecklistData] = useState<SetupChecklistData | null>(null)
  const [setupChecklistLoading, setSetupChecklistLoading] = useState(false)
  // Track enabled features per surgery (for dynamic feature checks)
  const [currentEnabledFeatures, setCurrentEnabledFeatures] = useState<Record<string, boolean>>(enabledFeatures)

  const selectedSurgery = surgeries.find(s => s.id === selectedSurgeryId)

  // Fetch setup checklist data when surgery changes
  useEffect(() => {
    if (!selectedSurgeryId) return

    // Reset data when surgery changes
    setSetupChecklistData(null)
    setSetupChecklistLoading(true)

    // Fetch setup checklist data
    fetch(`/api/admin/setup-checklist?surgeryId=${selectedSurgeryId}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          // Calculate outstanding count
          let outstandingCount = 0
          if (!data.onboardingCompleted) outstandingCount += 1
          if (!data.appointmentModelConfigured) outstandingCount += 1
          if (!data.aiCustomisationOccurred) outstandingCount += 1
          if (data.pendingCount > 0) outstandingCount += 1

          setSetupChecklistData({
            onboardingCompleted: data.onboardingCompleted,
            appointmentModelConfigured: data.appointmentModelConfigured,
            aiCustomisationOccurred: data.aiCustomisationOccurred,
            pendingCount: data.pendingCount,
            setupChecklistOutstandingCount: outstandingCount,
          })
        }
      })
      .catch(err => {
        console.error('Error loading setup checklist data:', err)
      })
      .finally(() => {
        setSetupChecklistLoading(false)
      })
  }, [selectedSurgeryId])

  // Fetch enabled features when surgery changes (for non-primary surgeries)
  useEffect(() => {
    if (!selectedSurgeryId) return
    // Only fetch if this is not the primary surgery (whose features we already have)
    if (selectedSurgeryId === primarySurgeryId) {
      setCurrentEnabledFeatures(enabledFeatures)
      return
    }

    fetch(`/api/surgeries/${selectedSurgeryId}/features`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          setCurrentEnabledFeatures(data.features || {})
        }
      })
      .catch(err => {
        console.error('Error loading surgery features:', err)
      })
  }, [selectedSurgeryId, primarySurgeryId, enabledFeatures])

  // Build cards based on selected surgery
  const buildCards = (): SettingsCard[] => {
    if (!selectedSurgeryId) return []

    const cards: SettingsCard[] = [
      {
        id: 'users',
        title: 'Users & access',
        description: 'Manage who has access to this surgery and their roles.',
        href: `/s/${selectedSurgeryId}/admin/users`,
        stats: selectedSurgery ? `${selectedSurgery._count.users} ${selectedSurgery._count.users === 1 ? 'user' : 'users'}` : undefined,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        ),
      },
      {
        id: 'features',
        title: 'Module access',
        description: 'Control which modules and features are enabled for this surgery.',
        href: '/admin/practice/modules',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
          </svg>
        ),
      },
    ]

    // Add Setup & onboarding if ai_surgery_customisation feature is enabled
    if (currentEnabledFeatures['ai_surgery_customisation']) {
      const outstandingCount = setupChecklistData?.setupChecklistOutstandingCount ?? 0
      const isComplete = outstandingCount === 0 && setupChecklistData !== null
      cards.push({
        id: 'setup-onboarding',
        title: 'Setup & onboarding',
        description: isComplete
          ? 'Setup complete. Review or update your surgery configuration.'
          : 'Complete your surgery setup to get started.',
        href: `/s/${selectedSurgeryId}/admin/setup-checklist`,
        badge: !setupChecklistLoading && outstandingCount > 0 ? outstandingCount : undefined,
        stats: setupChecklistLoading ? 'Loading...' : (isComplete ? 'Complete' : undefined),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
          </svg>
        ),
      })
    }

    // Add Practice Handbook admin if enabled
    if (currentEnabledFeatures['admin_toolkit']) {
      cards.push({
        id: 'handbook',
        title: 'Practice Handbook admin',
        description: 'Manage your practice handbook content, categories, and items.',
        href: `/s/${selectedSurgeryId}/admin-toolkit/admin`,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        ),
      })
    }

    // Add Workflow Guidance admin if enabled
    if (currentEnabledFeatures['workflow_guidance']) {
      cards.push({
        id: 'workflow',
        title: 'Workflow Guidance admin',
        description: 'Configure workflow templates and guidance for your surgery.',
        href: `/s/${selectedSurgeryId}/workflow/templates`,
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        ),
      })
    }

    // Add Analytics
    cards.push({
      id: 'analytics',
      title: 'Analytics',
      description: 'View usage statistics and insights for your surgery.',
      href: `/s/${selectedSurgeryId}/analytics`,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    })

    return cards
  }

  const cards = buildCards()

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={surgeries} currentSurgeryId={selectedSurgeryId} />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-nhs-dark-blue">
            Practice settings
          </h1>
          <p className="text-nhs-grey mt-2">
            Surgery-level administration across all modules. Manage users, access, and module-specific settings for your practice.
          </p>
        </div>

        {/* Surgery selector (if multiple surgeries) */}
        {surgeries.length > 1 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <label htmlFor="surgery-select" className="block text-sm font-medium text-nhs-grey mb-2">
              Select surgery
            </label>
            <select
              id="surgery-select"
              value={selectedSurgeryId}
              onChange={(e) => setSelectedSurgeryId(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue"
            >
              {surgeries.map((surgery) => (
                <option key={surgery.id} value={surgery.id}>
                  {surgery.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* No surgery selected state */}
        {!selectedSurgeryId && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-nhs-grey">No surgery selected. Please select a surgery to manage.</p>
          </div>
        )}

        {/* Settings cards */}
        {selectedSurgeryId && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card) => (
              <Link
                key={card.id}
                href={card.href}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:border-nhs-blue hover:shadow-md transition-all group relative"
              >
                {/* Badge indicator for outstanding items */}
                {card.badge !== undefined && card.badge > 0 && (
                  <span className="absolute top-3 right-3 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                    {card.badge} to do
                  </span>
                )}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 p-3 bg-nhs-light-blue rounded-lg text-nhs-blue group-hover:bg-nhs-blue group-hover:text-white transition-colors">
                    {card.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-nhs-dark-blue group-hover:text-nhs-blue transition-colors">
                      {card.title}
                    </h2>
                    <p className="text-sm text-nhs-grey mt-1 line-clamp-2">
                      {card.description}
                    </p>
                    {card.stats && (
                      <p className="text-xs text-nhs-blue font-medium mt-2">
                        {card.stats}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Quick links section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-nhs-blue flex-shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-nhs-dark-blue">
                Looking for module-specific settings?
              </h3>
              <p className="text-sm text-nhs-grey mt-1">
                For Signposting-specific configuration (symptoms, highlights, high-risk buttons), 
                go to{' '}
                <Link href="/admin" className="text-nhs-blue hover:underline font-medium">
                  Signposting settings
                </Link>.
              </p>
              {isSuperuser && (
                <p className="text-sm text-nhs-grey mt-2">
                  For system-wide configuration (surgeries, global users, AI usage), 
                  go to{' '}
                  <Link href="/admin/system" className="text-nhs-blue hover:underline font-medium">
                    System management
                  </Link>.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
