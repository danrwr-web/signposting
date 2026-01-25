'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useNavigationPanel } from '@/context/NavigationPanelContext'
import { useSurgery } from '@/context/SurgeryContext'
import { MODULES, MANAGEMENT_ITEMS, type ModuleItem, type ManagementItem } from '@/navigation/modules'
import HelpPanel, { HELP_PANEL_ID } from './HelpPanel'
import UserPreferencesModal from './UserPreferencesModal'

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
        <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-nhs-grey truncate">
              {surgeryName}
            </h2>
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
          {/* Modules Section */}
          <nav aria-label="Modules">
            <h3 className="px-5 text-xs font-semibold text-nhs-grey uppercase tracking-wider mb-2">
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
                        className="flex w-full items-center px-3 py-2.5 rounded-lg text-sm font-medium text-nhs-grey hover:bg-nhs-light-blue hover:text-nhs-blue transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-inset"
                      >
                        {module.label}
                      </button>
                    ) : (
                      <Link
                        href={enabled ? href : '#'}
                        onClick={(e) => handleModuleClick(e, module)}
                        className={`flex items-center px-3 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-inset ${
                          !enabled
                            ? 'text-gray-400 cursor-not-allowed font-medium'
                            : isActive
                              ? 'bg-nhs-light-blue text-nhs-blue font-semibold'
                              : 'text-nhs-grey hover:bg-nhs-light-blue hover:text-nhs-blue font-medium'
                        }`}
                        aria-disabled={!enabled}
                        aria-current={isActive ? 'page' : undefined}
                      >
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
              <h3 className="px-5 text-xs font-semibold text-nhs-grey uppercase tracking-wider mb-2">
                Management
              </h3>
              <ul className="space-y-1 px-3">
                {/* Only show Edit Handbook if admin_toolkit is enabled */}
                {MANAGEMENT_ITEMS.filter(item => {
                  if (item.id === 'edit-handbook') {
                    return enabledFeatures['admin_toolkit'] ?? false
                  }
                  if (item.id === 'workflow-editor') {
                    return enabledFeatures['workflow_guidance'] ?? false
                  }
                  return true
                }).map((item) => (
                  <li key={item.id}>
                    <Link
                      href={resolveHref(item.href)}
                      onClick={() => close()}
                      className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-nhs-grey hover:bg-nhs-light-blue hover:text-nhs-blue transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-inset"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
                {/* Feature settings - only for superusers */}
                {isSuperuser && (
                  <li>
                    <Link
                      href="/admin"
                      onClick={() => close()}
                      className="flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-nhs-grey hover:bg-nhs-light-blue hover:text-nhs-blue transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-inset"
                    >
                      Feature settings
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
          )}
        </div>

        {/* Preferences & Sign Out - Fixed at bottom */}
        <div className="border-t border-gray-200 p-4 flex-shrink-0 space-y-2">
          {/* Preferences Button */}
          <button
            onClick={() => {
              close()
              setShowPreferencesModal(true)
            }}
            className="w-full flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-nhs-grey border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 mr-2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Preferences
          </button>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-nhs-grey border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 mr-2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
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
