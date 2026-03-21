'use client'

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useNavigationPanel } from '@/context/NavigationPanelContext'
import { useSurgery } from '@/context/SurgeryContext'
import { MODULES, MANAGEMENT_ITEMS, type ModuleItem, type ManagementItem } from '@/navigation/modules'
import HelpPanel, { HELP_PANEL_ID } from './HelpPanel'
import UserPreferencesModal from './UserPreferencesModal'

const iconClass = "w-5 h-5"

function Icon({ d }: { d: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={iconClass} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

const MODULE_ICONS: Record<string, ReactNode> = {
  signposting: <Icon d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />,
  workflow: <Icon d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />,
  handbook: <Icon d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />,
  appointments: <Icon d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v7.5" />,
  help: <Icon d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />,
}

const MANAGEMENT_ICONS: Record<string, ReactNode> = {
  'practice-settings': <Icon d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />,
  'signposting-settings': <Icon d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />,
}

const DASHBOARD_ICON = <Icon d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />

const SYSTEM_MGMT_ICON = <Icon d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.049.58.025 1.194-.14 1.743Z" />

interface ModuleDisabledInfo {
  moduleName: string
  isAdmin: boolean
}

export default function UniversalNavigationPanel() {
  const { isOpen, close } = useNavigationPanel()
  const { surgery, canManageSurgery, isSuperuser } = useSurgery()
  const { data: session } = useSession()
  const pathname = usePathname()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [disabledModalInfo, setDisabledModalInfo] = useState<ModuleDisabledInfo | null>(null)
  const [enabledFeatures, setEnabledFeatures] = useState<Record<string, boolean>>({})
  const [featuresLoading, setFeaturesLoading] = useState(true) // Start as loading to avoid flash of "not enabled"
  const [lastFetchedSurgeryId, setLastFetchedSurgeryId] = useState<string | null>(null) // Track which surgery we've fetched for
  const [showPreferencesModal, setShowPreferencesModal] = useState(false)
  const [showHelpPanel, setShowHelpPanel] = useState(false)
  // Onboarding state for setup link (three states)
  const [onboardingStarted, setOnboardingStarted] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [onboardingFetched, setOnboardingFetched] = useState(false)

  const surgeryId = surgery?.id
  const surgeryName = surgery?.name || 'No surgery selected'
  const isAdmin = surgeryId ? canManageSurgery(surgeryId) : false
  const canSeeManagement = isAdmin || isSuperuser

  // Determine active module based on current route
  const getActiveModule = useCallback((): string | null => {
    if (!pathname || !surgeryId) return null
    
    const surgeryPrefix = `/s/${surgeryId}`
    
    // Check module routes (order matters - more specific first)
    if (pathname.startsWith(`${surgeryPrefix}/workflow`)) return 'workflow'
    if (pathname.startsWith(`${surgeryPrefix}/admin-toolkit`)) return 'handbook'
    if (pathname.startsWith(`${surgeryPrefix}/appointments`)) return 'appointments'
    if (pathname === surgeryPrefix || pathname === `${surgeryPrefix}/`) return 'signposting'
    
    return null
  }, [pathname, surgeryId])

  const activeModule = getActiveModule()

  // Fetch enabled features for the current surgery
  // Also depend on session status to re-fetch when session becomes available after login
  const sessionStatus = session?.user ? 'authenticated' : 'loading'
  
  useEffect(() => {
    if (!surgeryId) {
      // No surgery selected yet - keep loading state true to avoid showing "Not enabled"
      // Only clear features if we previously fetched for a different surgery
      if (lastFetchedSurgeryId !== null) {
        setEnabledFeatures({})
        setLastFetchedSurgeryId(null)
      }
      // Don't set featuresLoading to false - keep it true until we have a surgeryId to fetch
      return
    }

    // If we've already fetched for this surgery (and session is authenticated), don't re-fetch
    if (lastFetchedSurgeryId === surgeryId && sessionStatus === 'authenticated') {
      return
    }

    let isCancelled = false
    let retryCount = 0
    const maxRetries = 3
    const retryDelay = 500 // ms

    const fetchFeatures = async () => {
      setFeaturesLoading(true)
      
      while (retryCount < maxRetries && !isCancelled) {
        try {
          const response = await fetch(`/api/surgeries/${surgeryId}/features`)
          
          if (response.ok) {
            const data = await response.json()
            if (!isCancelled) {
              setEnabledFeatures(data.features || {})
              setLastFetchedSurgeryId(surgeryId)
              setFeaturesLoading(false)
            }
            return // Success - exit the retry loop
          }
          
          // If 401/403, session might not be ready yet - retry after delay
          if (response.status === 401 || response.status === 403) {
            retryCount++
            if (retryCount < maxRetries && !isCancelled) {
              await new Promise(resolve => setTimeout(resolve, retryDelay))
              continue
            }
          }
          
          // Other error - don't retry
          break
        } catch (error) {
          console.error('Error fetching surgery features:', error)
          retryCount++
          if (retryCount < maxRetries && !isCancelled) {
            await new Promise(resolve => setTimeout(resolve, retryDelay))
          }
        }
      }
      
      // If we exhausted retries or got a non-auth error, still set loading to false
      // but keep featuresLoading true if we never got a successful response
      // This way modules remain clickable
      if (!isCancelled && lastFetchedSurgeryId !== surgeryId) {
        // We failed to fetch - keep modules enabled (loading state)
        // Don't set featuresLoading to false so isModuleEnabled returns true
      }
    }

    fetchFeatures()
    
    return () => {
      isCancelled = true
    }
  }, [surgeryId, lastFetchedSurgeryId, sessionStatus])

  // Fetch onboarding status for setup link
  useEffect(() => {
    if (!surgeryId || !isAdmin) {
      setOnboardingStarted(false)
      setOnboardingCompleted(false)
      setOnboardingFetched(false)
      return
    }

    let isCancelled = false

    const fetchOnboardingStatus = async () => {
      try {
        const response = await fetch(`/api/admin/setup-checklist?surgeryId=${surgeryId}`)
        if (response.ok && !isCancelled) {
          const data = await response.json()
          setOnboardingStarted(data.onboardingStarted ?? false)
          setOnboardingCompleted(data.onboardingCompleted ?? false)
          setOnboardingFetched(true)
        }
      } catch (error) {
        console.error('Error fetching onboarding status:', error)
        if (!isCancelled) {
          setOnboardingFetched(true)
        }
      }
    }

    fetchOnboardingStatus()

    return () => {
      isCancelled = true
    }
  }, [surgeryId, isAdmin])

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showHelpPanel) {
        close()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, close, showHelpPanel])

  // Focus trap and initial focus
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [isOpen])

  // Handle click outside to close
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      close()
    }
  }, [close])

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    try {
      await signOut({ callbackUrl: '/' })
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }, [])

  // Check if a module is enabled
  // During loading, treat modules as enabled so they're clickable
  const isModuleEnabled = useCallback((module: ModuleItem): boolean => {
    if (module.alwaysEnabled) return true
    if (!module.featureKey) return true
    if (featuresLoading) return true // Allow navigation while loading
    return enabledFeatures[module.featureKey] ?? false
  }, [enabledFeatures, featuresLoading])

  // Handle module click
  const handleModuleClick = useCallback((e: React.MouseEvent, module: ModuleItem) => {
    if (!isModuleEnabled(module)) {
      e.preventDefault()
      setDisabledModalInfo({
        moduleName: module.label,
        isAdmin,
      })
    } else {
      close()
    }
  }, [isModuleEnabled, isAdmin, close])

  // Resolve href with surgery ID
  const resolveHref = useCallback((href: string): string => {
    if (!surgeryId) return '#'
    return href.replace('{surgeryId}', surgeryId)
  }, [surgeryId])

  // Close modal
  const closeDisabledModal = useCallback(() => {
    setDisabledModalInfo(null)
  }, [])

  if (!session?.user) {
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-200 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: 'rgba(66, 85, 99, 0.4)' }}
        onClick={handleBackdropClick}
        aria-hidden={!isOpen}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!isOpen}
        className={`fixed top-0 left-0 z-[70] w-80 bg-white shadow-xl transform transition-transform duration-200 ease-out flex flex-col h-screen ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ height: '100dvh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex-1 min-w-0 border-l-[3px] border-nhs-blue pl-3">
            <h2 className="text-base font-semibold text-nhs-dark-grey truncate">
              {surgeryName}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">NHS Signposting Toolkit</p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={close}
            className="ml-4 p-2 rounded-md text-nhs-grey hover:bg-nhs-light-grey hover:text-nhs-dark-grey transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
            aria-label="Close navigation menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto py-4">
          {/* Dashboard link — admin users only, only during active onboarding */}
          {isAdmin && surgeryId && onboardingFetched && !onboardingCompleted && (
            <nav aria-label="Dashboard" className="mb-4">
              <ul className="px-3">
                <li>
                  <Link
                    href={`/s/${surgeryId}/dashboard`}
                    onClick={() => close()}
                    className="group flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-nhs-grey hover:bg-nhs-light-blue hover:text-nhs-blue transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-inset"
                  >
                    <span className="mr-3 flex-shrink-0 text-gray-400 group-hover:text-nhs-blue" aria-hidden="true">{DASHBOARD_ICON}</span>
                    Dashboard
                  </Link>
                </li>
              </ul>
            </nav>
          )}

          {/* Modules Section */}
          <nav aria-label="Modules">
            <h3 className="px-5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Modules
            </h3>
            <ul className="space-y-1 px-3">
              {MODULES.map((module) => {
                const enabled = isModuleEnabled(module)
                const isHelp = module.id === 'help'
                const href = isHelp ? module.href : resolveHref(module.href)
                const isActive = activeModule === module.id

                return (
                  <li key={module.id}>
                    {isHelp ? (
                      <button
                        type="button"
                        onClick={() => setShowHelpPanel(true)}
                        aria-haspopup="dialog"
                        aria-expanded={showHelpPanel}
                        aria-controls={HELP_PANEL_ID}
                        className="group flex w-full items-center px-3 py-2.5 rounded-lg text-sm font-medium text-nhs-grey hover:bg-nhs-light-blue hover:text-nhs-blue transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-inset"
                      >
                        {MODULE_ICONS[module.id] && (
                          <span className="mr-3 flex-shrink-0 text-gray-400 group-hover:text-nhs-blue" aria-hidden="true">{MODULE_ICONS[module.id]}</span>
                        )}
                        {module.label}
                      </button>
                    ) : (
                      <Link
                        href={enabled ? href : '#'}
                        onClick={(e) => handleModuleClick(e, module)}
                        className={`group flex items-center px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-inset ${
                          !enabled
                            ? 'text-gray-400 cursor-not-allowed font-medium'
                            : isActive
                              ? 'bg-nhs-light-blue text-nhs-blue font-semibold'
                              : 'text-nhs-grey hover:bg-nhs-light-blue hover:text-nhs-blue font-medium'
                        }`}
                        aria-disabled={!enabled}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {MODULE_ICONS[module.id] && (
                          <span className={`mr-3 flex-shrink-0 ${
                            !enabled ? 'text-gray-300' : isActive ? 'text-nhs-blue' : 'text-gray-400 group-hover:text-nhs-blue'
                          }`} aria-hidden="true">{MODULE_ICONS[module.id]}</span>
                        )}
                        {module.label}
                        {!enabled && !featuresLoading && (
                          <span className="ml-2 text-xs text-gray-400 italic font-normal">
                            Not enabled
                          </span>
                        )}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Management Section - Only visible to admins */}
          {canSeeManagement && surgeryId && (
            <nav aria-label="Management" className="mt-8 pt-6 border-t border-gray-100">
              <h3 className="px-5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Management
              </h3>
              <ul className="space-y-1 px-3">
                {/* Practice settings and Signposting settings links */}
                {MANAGEMENT_ITEMS.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={resolveHref(item.href)}
                      onClick={() => close()}
                      className="group flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-nhs-grey hover:bg-nhs-light-blue hover:text-nhs-blue transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-inset"
                    >
                      {MANAGEMENT_ICONS[item.id] && (
                        <span className="mr-3 flex-shrink-0 text-gray-400 group-hover:text-nhs-blue" aria-hidden="true">{MANAGEMENT_ICONS[item.id]}</span>
                      )}
                      {item.label}
                    </Link>
                  </li>
                ))}
                {/* Begin/Finish setup — only shown pre-completion; post-completion access is via Practice Settings */}
                {isAdmin && onboardingFetched && !onboardingCompleted && (
                  <li>
                    <Link
                      href={`/s/${surgeryId}/admin/setup-checklist`}
                      onClick={() => close()}
                      className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium bg-nhs-blue text-white hover:bg-nhs-dark-blue transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-inset"
                    >
                      {onboardingStarted && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 mr-2 flex-shrink-0" aria-hidden="true" />
                      )}
                      {onboardingStarted ? 'Finish setup' : 'Begin setup'}
                    </Link>
                  </li>
                )}
                {/* System management - only for superusers */}
                {isSuperuser && (
                  <li>
                    <Link
                      href="/admin/system"
                      onClick={() => close()}
                      className="group flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-nhs-grey hover:bg-nhs-light-blue hover:text-nhs-blue transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-inset"
                    >
                      <span className="mr-3 flex-shrink-0 text-gray-400 group-hover:text-nhs-blue" aria-hidden="true">{SYSTEM_MGMT_ICON}</span>
                      System management
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
          )}
        </div>

        {/* Preferences & Sign Out - Fixed at bottom */}
        <div className="border-t border-gray-200 px-3 py-3 flex-shrink-0 space-y-1">
          {/* Preferences Button */}
          <button
            onClick={() => {
              close()
              setShowPreferencesModal(true)
            }}
            className="group w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-nhs-grey hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-inset"
          >
            <span className="mr-3 flex-shrink-0 text-gray-400 group-hover:text-nhs-blue" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            Preferences
          </button>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="group w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-nhs-grey hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-inset"
          >
            <span className="mr-3 flex-shrink-0 text-gray-400 group-hover:text-nhs-blue" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
            </span>
            Sign out
          </button>
        </div>
      </aside>

      {/* User Preferences Modal */}
      <UserPreferencesModal 
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
      />

      <HelpPanel
        isOpen={showHelpPanel}
        onClose={() => setShowHelpPanel(false)}
      />

      {/* Disabled Module Modal */}
      {disabledModalInfo && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(66, 85, 99, 0.5)' }}
          onClick={closeDisabledModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="disabled-module-title"
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="disabled-module-title"
              className="text-lg font-semibold text-nhs-grey mb-4"
            >
              {disabledModalInfo.moduleName}
            </h2>
            <p className="text-sm text-nhs-grey leading-relaxed mb-6">
              {disabledModalInfo.isAdmin ? (
                <>
                  This module isn&apos;t enabled for your surgery.
                  <br />
                  If you&apos;d like to discuss enabling it, please contact us.
                </>
              ) : (
                <>
                  This module isn&apos;t enabled for your surgery.
                  <br />
                  If you think it would be useful, please speak to a practice admin.
                </>
              )}
            </p>
            <div className="flex justify-end">
              <button
                onClick={closeDisabledModal}
                autoFocus
                className="px-4 py-2 text-sm font-medium text-white bg-nhs-blue rounded-md hover:bg-nhs-dark-blue transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
