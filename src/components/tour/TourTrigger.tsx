'use client'

import { useCallback } from 'react'
import { useNavigationPanel } from '@/context/NavigationPanelContext'
import { useTour } from './TourProvider'
import { useRouter, usePathname } from 'next/navigation'
import { useSurgery } from '@/context/SurgeryContext'

/**
 * "Take a tour" button rendered in the navigation panel footer.
 * Closes the panel, navigates to the signposting page if needed,
 * then starts the onboarding tour.
 */
export default function TourTrigger() {
  const { close } = useNavigationPanel()
  const { startTour } = useTour()
  const { surgery } = useSurgery()
  const router = useRouter()
  const pathname = usePathname()

  const handleClick = useCallback(() => {
    close()

    const surgeryId = surgery?.id
    const isOnSignpostingPage =
      pathname !== null &&
      surgeryId &&
      pathname === `/s/${surgeryId}`

    // Small delay to let the nav panel slide out before starting the tour
    setTimeout(() => {
      if (!isOnSignpostingPage && surgeryId) {
        // Navigate to signposting page first, then start tour
        router.push(`/s/${surgeryId}`)
        // Tour will auto-start because hasCompletedOnboarding will be reset
        // We trigger it manually after a longer delay to let the page render
        setTimeout(() => startTour('onboarding'), 1200)
      } else {
        startTour('onboarding')
      }
    }, 250)
  }, [close, startTour, surgery?.id, pathname, router])

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-nhs-blue border border-nhs-blue hover:bg-nhs-light-blue transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
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
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
        />
      </svg>
      Take the tour
    </button>
  )
}
