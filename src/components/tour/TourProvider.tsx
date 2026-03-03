'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import {
  ONBOARDING_PAGE1_STEPS,
  ONBOARDING_PAGE2_STEPS,
  DEMO_PAGE1_STEPS,
  DEMO_PAGE2_STEPS,
  filterVisibleSteps,
  toDriverSteps,
  type TourStepConfig,
} from './tourSteps'

// Session storage key for cross-page tour state
const TOUR_SESSION_KEY = 'signposting-tour-state'

interface TourSessionState {
  tourKey: 'onboarding' | 'demo'
  page: 1 | 2
  firstSymptomId?: string
}

interface TourContextValue {
  isActive: boolean
  startTour: (tourKey?: 'onboarding' | 'demo') => void
  stopTour: () => void
  hasCompletedOnboarding: boolean | null // null = loading
}

const TourContext = createContext<TourContextValue | undefined>(undefined)

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (!ctx) {
    throw new Error('useTour must be used within TourProvider')
  }
  return ctx
}

/** Wait for target elements to appear in the DOM (up to maxWaitMs) */
async function waitForElements(
  selectors: (string | undefined)[],
  maxWaitMs = 2000
): Promise<void> {
  const start = Date.now()
  const realSelectors = selectors.filter(Boolean) as string[]
  if (realSelectors.length === 0) return

  while (Date.now() - start < maxWaitMs) {
    const allPresent = realSelectors.every(
      (sel) => document.querySelector(sel) !== null
    )
    if (allPresent) return
    await new Promise((r) => setTimeout(r, 200))
  }
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: sessionStatus } = useSession()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const [isActive, setIsActive] = useState(false)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<
    boolean | null
  >(null)

  // Refs to avoid stale closures
  const driverRef = useRef<ReturnType<typeof import('driver.js')['driver']> | null>(null)
  const hasCheckedRef = useRef(false)
  const isStartingRef = useRef(false)

  // Determine what page we're on
  const isDemoParam = searchParams.get('demo') === 'true'
  const isTourResumeParam = searchParams.get('tour') === '1'
  const isSignpostingPage =
    pathname !== null && /^\/s\/[^/]+\/?$/.test(pathname)
  const isSymptomDetailPage =
    pathname !== null && /^\/symptom\/[^/]+\/?$/.test(pathname)

  // Extract surgery ID from the current path or search params
  const surgeryId =
    searchParams.get('surgery') ||
    (pathname?.match(/^\/s\/([^/]+)/)?.[1] ?? null)

  // ----- Persist tour state to API -----
  const persistTourState = useCallback(
    async (data: {
      tourKey: string
      completedAt?: string
      skippedAt?: string
      lastStepIdx?: number
    }) => {
      try {
        await fetch('/api/user/tour-state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      } catch {
        // Silently fail — tour state is best-effort
      }
    },
    []
  )

  // ----- Start tour -----
  const startTour = useCallback(
    async (tourKey: 'onboarding' | 'demo' = 'onboarding') => {
      if (isStartingRef.current || isActive) return
      isStartingRef.current = true

      try {
        // Determine which steps to use based on page and tour key
        let steps: TourStepConfig[]
        let stepOffset = 0
        let totalSteps: number
        let isPage2 = false

        // Check if we're resuming on page 2
        const sessionState = getSessionState()
        if (
          (isTourResumeParam || sessionState) &&
          isSymptomDetailPage
        ) {
          isPage2 = true
          const key = sessionState?.tourKey ?? tourKey
          steps =
            key === 'demo' ? DEMO_PAGE2_STEPS : ONBOARDING_PAGE2_STEPS
          const page1Steps =
            key === 'demo' ? DEMO_PAGE1_STEPS : ONBOARDING_PAGE1_STEPS
          stepOffset = filterVisibleSteps(page1Steps).length
          totalSteps = stepOffset + steps.length
          tourKey = key as 'onboarding' | 'demo'
        } else {
          steps =
            tourKey === 'demo'
              ? DEMO_PAGE1_STEPS
              : ONBOARDING_PAGE1_STEPS
          const page2Steps =
            tourKey === 'demo'
              ? DEMO_PAGE2_STEPS
              : ONBOARDING_PAGE2_STEPS
          totalSteps = steps.length + page2Steps.length
        }

        // Wait for target elements to render
        await waitForElements(steps.map((s) => s.element))

        // Filter to only steps whose targets exist
        const visibleSteps = filterVisibleSteps(steps)
        if (visibleSteps.length === 0) {
          isStartingRef.current = false
          return
        }

        // Recalculate totalSteps with filtered page1
        if (!isPage2) {
          const page2Steps =
            tourKey === 'demo'
              ? DEMO_PAGE2_STEPS
              : ONBOARDING_PAGE2_STEPS
          totalSteps = visibleSteps.length + page2Steps.length
        }

        // Find the transition step index (if any)
        const transitionIdx = visibleSteps.findIndex(
          (s) => s.isPageTransition
        )

        // Dynamic import for code-splitting
        const { driver } = await import('driver.js')

        const driverSteps = toDriverSteps(visibleSteps, totalSteps, stepOffset)

        const driverInstance = driver({
          showProgress: true,
          allowClose: true,
          stagePadding: 8,
          stageRadius: 8,
          animate: true,
          steps: driverSteps,
          onNextClick: (element, step, opts) => {
            const currentIdx = opts.state.activeIndex ?? 0

            // Handle page transition
            if (
              !isPage2 &&
              transitionIdx >= 0 &&
              currentIdx === transitionIdx
            ) {
              handlePageTransition(tourKey)
              return
            }

            driverInstance.moveNext()
          },
          onCloseClick: () => {
            driverInstance.destroy()
          },
          onDestroyStarted: () => {
            // Check if the tour was completed (last step) or skipped
            const activeIdx = driverInstance.getActiveIndex() ?? 0
            const isLastStep =
              isPage2 && activeIdx === visibleSteps.length - 1

            if (isLastStep) {
              // Tour completed
              if (tourKey !== 'demo') {
                persistTourState({
                  tourKey,
                  completedAt: new Date().toISOString(),
                })
                setHasCompletedOnboarding(true)
              }
            } else {
              // Tour skipped/dismissed
              if (tourKey !== 'demo') {
                persistTourState({
                  tourKey,
                  skippedAt: new Date().toISOString(),
                  lastStepIdx: stepOffset + activeIdx,
                })
                setHasCompletedOnboarding(true)
              }
            }

            clearSessionState()
            driverInstance.destroy()
            setIsActive(false)
            driverRef.current = null
          },
          onDestroyed: () => {
            setIsActive(false)
            driverRef.current = null
          },
        })

        driverRef.current = driverInstance
        setIsActive(true)
        driverInstance.drive()
      } finally {
        isStartingRef.current = false
      }
    },
    [
      isActive,
      isTourResumeParam,
      isSymptomDetailPage,
      persistTourState,
    ]
  )

  // ----- Handle cross-page transition -----
  const handlePageTransition = useCallback(
    (tourKey: 'onboarding' | 'demo') => {
      // Find the first symptom card link on the page
      const firstCard = document.querySelector(
        '[data-tour="symptom-card"]'
      )
      const link = firstCard?.closest('a')
      const href = link?.getAttribute('href')

      if (href) {
        // Destroy current driver instance
        if (driverRef.current) {
          // Remove event listeners without triggering onDestroyStarted
          driverRef.current.destroy()
          driverRef.current = null
        }

        // Save state for page 2
        setSessionState({ tourKey, page: 2 })

        // Navigate to symptom detail with tour resume param
        const url = new URL(href, window.location.origin)
        url.searchParams.set('tour', '1')
        setIsActive(false)
        router.push(url.pathname + url.search)
      } else {
        // No symptom card found — just continue the tour
        driverRef.current?.moveNext()
      }
    },
    [router]
  )

  // ----- Stop tour -----
  const stopTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy()
      driverRef.current = null
    }
    clearSessionState()
    setIsActive(false)
  }, [])

  // ----- Session storage helpers -----
  function getSessionState(): TourSessionState | null {
    if (typeof window === 'undefined') return null
    try {
      const raw = sessionStorage.getItem(TOUR_SESSION_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  function setSessionState(state: TourSessionState) {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem(TOUR_SESSION_KEY, JSON.stringify(state))
    } catch {
      // Ignore
    }
  }

  function clearSessionState() {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.removeItem(TOUR_SESSION_KEY)
    } catch {
      // Ignore
    }
  }

  // ----- Check onboarding completion status on mount -----
  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !session?.user) return
    if (hasCheckedRef.current) return
    hasCheckedRef.current = true

    async function checkTourState() {
      try {
        const res = await fetch(
          '/api/user/tour-state?tourKey=onboarding'
        )
        if (!res.ok) {
          setHasCompletedOnboarding(false)
          return
        }
        const data = await res.json()
        if (data === null) {
          setHasCompletedOnboarding(false)
        } else {
          setHasCompletedOnboarding(
            !!(data.completedAt || data.skippedAt)
          )
        }
      } catch {
        setHasCompletedOnboarding(false)
      }
    }

    checkTourState()
  }, [sessionStatus, session?.user])

  // ----- Auto-trigger: first login on signposting page -----
  useEffect(() => {
    if (hasCompletedOnboarding !== false) return
    if (!isSignpostingPage) return
    if (isDemoParam) return // demo mode handled separately
    if (isActive) return

    const timer = setTimeout(() => {
      startTour('onboarding')
    }, 800)

    return () => clearTimeout(timer)
  }, [hasCompletedOnboarding, isSignpostingPage, isDemoParam, isActive, startTour])

  // ----- Auto-trigger: demo mode -----
  useEffect(() => {
    if (!isDemoParam) return
    if (!isSignpostingPage) return
    if (isActive) return

    const timer = setTimeout(() => {
      startTour('demo')
    }, 800)

    return () => clearTimeout(timer)
  }, [isDemoParam, isSignpostingPage, isActive, startTour])

  // ----- Auto-trigger: resume after page transition -----
  useEffect(() => {
    if (!isTourResumeParam) return
    if (!isSymptomDetailPage) return
    if (isActive) return

    const sessionState = getSessionState()
    if (!sessionState) return

    const timer = setTimeout(() => {
      startTour(sessionState.tourKey)
    }, 800)

    return () => clearTimeout(timer)
  }, [isTourResumeParam, isSymptomDetailPage, isActive, startTour])

  // ----- Cleanup on unmount -----
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy()
        driverRef.current = null
      }
    }
  }, [])

  const value: TourContextValue = {
    isActive,
    startTour,
    stopTour,
    hasCompletedOnboarding,
  }

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}
