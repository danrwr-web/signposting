'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigationPanel } from '@/context/NavigationPanelContext'

const STORAGE_KEY = 'hasSeenNavUpdate'

interface NavUpdateTooltipProps {
  /** Ref to the trigger button for positioning */
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

/**
 * A one-time spotlight tooltip that introduces the new navigation panel.
 * Shows once per user, then never again after dismissal.
 */
export default function NavUpdateTooltip({ triggerRef }: NavUpdateTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const { isOpen: isPanelOpen } = useNavigationPanel()

  // Check for reduced motion preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPrefersReducedMotion(
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      )
    }
  }, [])

  // Check if user has already seen the tooltip
  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return

    const hasSeen = localStorage.getItem(STORAGE_KEY)
    if (!hasSeen) {
      // Small delay to ensure layout is settled
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [])

  // Update position when visible or trigger moves
  useEffect(() => {
    if (!isVisible || !triggerRef.current) return

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect) {
        // Position tooltip below and to the right of the trigger
        setPosition({
          top: rect.bottom + 8,
          left: rect.left,
        })
      }
    }

    updatePosition()

    // Update on resize/scroll
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isVisible, triggerRef])

  // Dismiss function
  const dismiss = useCallback(() => {
    setIsVisible(false)
    localStorage.setItem(STORAGE_KEY, 'true')
  }, [])

  // Handle escape key
  useEffect(() => {
    if (!isVisible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, dismiss])

  // Auto-dismiss when navigation panel opens
  useEffect(() => {
    if (isPanelOpen && isVisible) {
      dismiss()
    }
  }, [isPanelOpen, isVisible, dismiss])

  // Handle click outside
  useEffect(() => {
    if (!isVisible) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      // Don't dismiss if clicking the tooltip itself
      if (tooltipRef.current?.contains(target)) return
      // Don't dismiss if clicking the trigger (let it open the panel)
      if (triggerRef.current?.contains(target)) return
      dismiss()
    }

    // Use mousedown for faster response
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isVisible, dismiss, triggerRef])

  if (!isVisible) return null

  return (
    <>
      {/* Subtle backdrop */}
      <div
        className={`fixed inset-0 z-[55] bg-black/5 ${
          prefersReducedMotion ? '' : 'transition-opacity duration-150'
        }`}
        aria-hidden="true"
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-labelledby="nav-update-title"
        aria-describedby="nav-update-body"
        className="fixed z-[56] w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-4"
        style={{
          top: position.top,
          left: position.left,
          animation: prefersReducedMotion ? 'none' : 'navTooltipFadeIn 150ms ease-out',
        }}
      >
        {/* Arrow pointing to trigger */}
        <div
          className="absolute -top-2 left-4 w-4 h-4 bg-white border-l border-t border-gray-200 transform rotate-45"
          aria-hidden="true"
        />

        <h2
          id="nav-update-title"
          className="text-base font-semibold text-nhs-grey mb-2"
        >
          New navigation
        </h2>

        <p
          id="nav-update-body"
          className="text-sm text-nhs-grey leading-relaxed mb-4"
        >
          You can now switch between Signposting, Workflow Guidance and the
          Practice Handbook using this menu.
        </p>

        <button
          onClick={dismiss}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-nhs-blue rounded-md hover:bg-nhs-dark-blue transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
          autoFocus
        >
          Got it
        </button>
      </div>
    </>
  )
}
