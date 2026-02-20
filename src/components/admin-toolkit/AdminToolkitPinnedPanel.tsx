'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export type AdminToolkitPinnedPanelData = {
  taskBuddyText: string | null
  postRouteText: string | null
  updatedAt: Date
}

interface AdminToolkitPinnedPanelProps {
  surgeryId: string
  canWrite: boolean
  onTakeWeekCommencingUtc: Date
  onTakeWeekEndUtc: Date
  onTakeGpName: string | null
  panel: AdminToolkitPinnedPanelData
  variant?: 'fixed' | 'inline'
}

function formatDateNoWeekday(date: Date): string {
  return date.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric' })
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

const STORAGE_KEY = 'adminToolkit.operationalInfoPanel.isExpanded'
const LAST_SEEN_KEY = 'adminToolkit.operationalInfoPanel.lastSeenOnTake'

export default function AdminToolkitPinnedPanel({
  surgeryId,
  canWrite,
  onTakeWeekCommencingUtc,
  onTakeWeekEndUtc,
  onTakeGpName,
  panel,
  variant = 'fixed',
}: AdminToolkitPinnedPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Initialize state from localStorage and check for auto-expand
  useEffect(() => {
    setIsMounted(true)
    
    try {
      // Check if on-take GP has changed
      const currentOnTakeToken = onTakeGpName 
        ? `${onTakeGpName}|${onTakeWeekCommencingUtc.toISOString().slice(0, 10)}`
        : null
      
      const lastSeenToken = localStorage.getItem(LAST_SEEN_KEY)
      
      // Auto-expand if on-take GP changed and is not blank
      if (currentOnTakeToken && currentOnTakeToken !== lastSeenToken) {
        setIsExpanded(true)
        localStorage.setItem(STORAGE_KEY, 'true')
        if (currentOnTakeToken) {
          localStorage.setItem(LAST_SEEN_KEY, currentOnTakeToken)
        }
      } else {
        // Otherwise, use saved preference (default to collapsed)
        const saved = localStorage.getItem(STORAGE_KEY)
        setIsExpanded(saved === 'true')
      }
    } catch (error) {
      // localStorage unavailable, default to collapsed
      setIsExpanded(false)
    }
  }, [onTakeGpName, onTakeWeekCommencingUtc])

  // Update localStorage when expanded state changes (but not on initial mount)
  useEffect(() => {
    if (!isMounted) return
    
    try {
      localStorage.setItem(STORAGE_KEY, isExpanded ? 'true' : 'false')
    } catch (error) {
      // localStorage unavailable, ignore
    }
  }, [isExpanded, isMounted])

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleExpanded()
    }
  }

  const outerClassName =
    variant === 'fixed'
      ? 'fixed inset-x-0 bottom-0 border-t border-[#D8E4F0] bg-[#F3F7FB]/95 backdrop-blur-sm'
      : 'mt-8 border-t border-[#D8E4F0] bg-[#F3F7FB]'

  // Don't render until mounted to avoid hydration mismatch
  if (!isMounted) {
    return null
  }

  return (
    <div className={outerClassName} data-handbook-bottom-bar>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {isExpanded ? (
          <div className="rounded-2xl border border-[#D8E4F0] bg-[#F3F7FB] shadow-sm">
            {/* Header */}
            <div className="px-4 py-3 bg-nhs-blue rounded-t-2xl">
              <button
                onClick={toggleExpanded}
                onKeyDown={handleKeyDown}
                className="w-full flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-nhs-yellow focus:ring-offset-2 focus:ring-offset-nhs-blue rounded"
                aria-expanded="true"
                aria-label="Hide practice operational info"
              >
                <h2 className="text-base font-semibold text-white">Practice operational info</h2>
                <div className="flex items-center gap-2 text-sm text-white">
                  <span>Hide</span>
                  <ChevronDown className="h-5 w-5 rotate-180 transition-transform" />
                </div>
              </button>
            </div>

            {/* Content */}
            <div className="divide-y divide-[#D8E4F0] lg:divide-y-0 lg:divide-x lg:flex">
              {/* Left column - narrower, full width on mobile/tablet */}
              <section className="p-4 lg:min-w-[240px] lg:max-w-[320px]">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">On-take GP rota</div>
                <div className="mt-1">
                  {onTakeGpName ? (
                    <div className="text-base font-semibold text-gray-900">{onTakeGpName}</div>
                  ) : (
                    <div className="text-base font-semibold text-gray-400">Not set</div>
                  )}
                  <div className="mt-1 text-xs text-gray-500">
                    Week of Monday {formatDateNoWeekday(onTakeWeekCommencingUtc)} to Sunday {formatDateNoWeekday(onTakeWeekEndUtc)}
                  </div>
                </div>
                {!onTakeGpName && canWrite ? (
                  <div className="mt-2">
                    <Link
                      href={`/s/${surgeryId}/admin-toolkit/admin#on-take`}
                      className="text-sm font-medium text-nhs-blue hover:text-nhs-dark-blue underline-offset-2 hover:underline"
                    >
                      Set on-take GP
                    </Link>
                  </div>
                ) : null}
              </section>

              {/* Middle and right columns - side by side on tablet, stacked on mobile */}
              <div className="lg:flex lg:flex-1 divide-y divide-[#D8E4F0] lg:divide-y-0 lg:divide-x">
                {/* Middle column - equal width with right */}
                <section className="p-4 lg:flex-1">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Task buddy system</div>
                  <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">
                    {panel.taskBuddyText?.trim() ? panel.taskBuddyText : <span className="text-gray-400">Not set</span>}
                  </div>
                </section>

                {/* Right column - equal width with middle */}
                <section className="p-4 lg:flex-1">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Post route</div>
                  <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">
                    {panel.postRouteText?.trim() ? panel.postRouteText : <span className="text-gray-400">Not set</span>}
                  </div>
                </section>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={toggleExpanded}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-[#D8E4F0] bg-nhs-blue px-4 py-3.5 flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-nhs-yellow focus:ring-offset-2 focus:ring-offset-nhs-blue transition-colors hover:bg-nhs-dark-blue min-h-[48px]"
            aria-expanded="false"
            aria-label="Show practice operational info"
          >
            <span className="text-base font-medium text-white">Practice operational info</span>
            <div className="flex items-center gap-2 text-sm text-white">
              <span>Show</span>
              <ChevronDown className="h-5 w-5 transition-transform" />
            </div>
          </button>
        )}
      </div>
    </div>
  )
}
