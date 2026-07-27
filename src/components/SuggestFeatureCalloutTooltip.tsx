'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigationPanel } from '@/context/NavigationPanelContext'
import { useFeatureCallout } from '@/hooks/useFeatureCallout'
import {
  NAV_UPDATE_CALLOUT_KEY,
  NAV_UPDATE_LEGACY_STORAGE_KEY,
} from './NavUpdateTooltip'

export const SUGGEST_FEATURE_CALLOUT_KEY = 'suggest-feature-2026-07'
export const SUGGEST_FEATURE_CALLOUT_DAYS = 5

interface SuggestFeatureCalloutTooltipProps {
  /** Ref to the trigger button for positioning */
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

/**
 * Time-boxed spotlight introducing the in-app feedback feature. Points at the
 * navigation trigger for a few days after each user's next visit, and stops
 * as soon as it is dismissed or the window lapses. Defers to the older
 * navigation coach mark so the two tooltips never stack.
 */
export default function SuggestFeatureCalloutTooltip({
  triggerRef,
}: SuggestFeatureCalloutTooltipProps) {
  const { windowActive, tooltipVisible, dismissTooltip } = useFeatureCallout(
    SUGGEST_FEATURE_CALLOUT_KEY,
    SUGGEST_FEATURE_CALLOUT_DAYS
  )
  // Mirror the nav coach mark's state (shared request cache — no extra call)
  // so the two tooltips never stack: ours waits until that one is dismissed.
  const navCallout = useFeatureCallout(NAV_UPDATE_CALLOUT_KEY, undefined, {
    legacySeenKey: NAV_UPDATE_LEGACY_STORAGE_KEY,
  })
  const [settled, setSettled] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const { isOpen: isPanelOpen } = useNavigationPanel()

  useEffect(() => {
    if (typeof window === 'undefined') return
    setPrefersReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    const timer = setTimeout(() => setSettled(true), 600)
    return () => clearTimeout(timer)
  }, [])

  const isVisible =
    tooltipVisible &&
    windowActive &&
    settled &&
    navCallout.resolved &&
    !navCallout.tooltipVisible

  // Track the trigger's position while visible
  useEffect(() => {
    if (!isVisible || !triggerRef.current) return

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (rect) {
        setPosition({ top: rect.bottom + 8, left: rect.left })
      }
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isVisible, triggerRef])

  const dismiss = useCallback(() => {
    dismissTooltip()
  }, [dismissTooltip])

  // Escape dismisses
  useEffect(() => {
    if (!isVisible) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, dismiss])

  // Opening the menu counts as "found it"
  useEffect(() => {
    if (isPanelOpen && isVisible) dismiss()
  }, [isPanelOpen, isVisible, dismiss])

  // Click outside dismisses (clicking the trigger opens the panel instead)
  useEffect(() => {
    if (!isVisible) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (tooltipRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      dismiss()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isVisible, dismiss, triggerRef])

  if (!isVisible) return null

  return (
    <>
      <div
        className={`fixed inset-0 z-[55] bg-black/5 ${
          prefersReducedMotion ? '' : 'transition-opacity duration-150'
        }`}
        aria-hidden="true"
      />

      <div
        ref={tooltipRef}
        role="dialog"
        aria-labelledby="suggest-callout-title"
        aria-describedby="suggest-callout-body"
        className="fixed z-[56] w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-4"
        style={{
          top: position.top,
          left: position.left,
          animation: prefersReducedMotion ? 'none' : 'navTooltipFadeIn 150ms ease-out',
        }}
      >
        <div
          className="absolute -top-2 left-4 w-4 h-4 bg-white border-l border-t border-gray-200 transform rotate-45"
          aria-hidden="true"
        />

        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-nhs-green text-white uppercase tracking-wide">
            New
          </span>
          <h2 id="suggest-callout-title" className="text-base font-semibold text-nhs-grey">
            Suggest a feature
          </h2>
        </div>

        <p id="suggest-callout-body" className="text-sm text-nhs-grey leading-relaxed mb-4">
          Got an idea, improvement, or bug to report? Open this menu and choose{' '}
          <span className="font-medium">Suggest a feature</span> — then track responses under{' '}
          <span className="font-medium">My suggestions</span>.
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
