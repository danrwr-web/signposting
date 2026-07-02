'use client'

import { RefObject, useEffect, useState } from 'react'
import SearchBox from './SearchBox'
import LetterPills, { Letter } from './LetterPills'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'

interface StickyFilterBarProps {
  /** Sentinel element placed just below the main filter toolbar; the bar shows once it scrolls out of view above */
  sentinelRef: RefObject<HTMLElement>
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedLetter: Letter
  onLetterChange: (letter: Letter) => void
  /** Symptom list for A-Z letter availability (filtered by age band, not by text search) */
  symptoms?: EffectiveSymptom[]
  resultsCount: number
  totalCount: number
}

/**
 * A slim bar with the search box and A-Z pills that slides in once the main
 * filter toolbar has scrolled out of view, so the core filters stay reachable
 * while browsing a long symptom list.
 */
export default function StickyFilterBar({
  sentinelRef,
  searchTerm,
  onSearchChange,
  selectedLetter,
  onLetterChange,
  symptoms,
  resultsCount,
  totalCount,
}: StickyFilterBarProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(([entry]) => {
      // Only show when the toolbar has scrolled out of view *above* the
      // viewport — not when the page is simply too short to scroll.
      setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sentinelRef])

  if (!visible) return null

  // animate-slide-down-in is defined in globals.css, gated behind prefers-reduced-motion
  return (
    <div className="fixed top-0 inset-x-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm animate-slide-down-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-4">
        <div className="w-full max-w-[240px] flex-shrink-0">
          <SearchBox
            value={searchTerm}
            onChange={onSearchChange}
            placeholder="Search symptoms..."
            debounceMs={250}
          />
        </div>
        {/* Pills wrap onto a second row on narrower screens so every letter stays visible */}
        <div className="flex-1 flex flex-wrap gap-1.5 py-0.5">
          <LetterPills
            selectedLetter={selectedLetter}
            onLetterChange={onLetterChange}
            symptoms={symptoms}
            pillSizeClasses="h-8 min-w-8 px-0"
          />
        </div>
        <span className="hidden lg:block text-sm text-nhs-grey whitespace-nowrap flex-shrink-0" aria-live="polite">
          {resultsCount} of {totalCount}
        </span>
      </div>
    </div>
  )
}
