'use client'

import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'

interface CommonReasonsRowProps {
  items: EffectiveSymptom[]
  surgeryId?: string
}

export default function CommonReasonsRow({ items, surgeryId }: CommonReasonsRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // Check overflow and scroll position
  const updateScrollState = () => {
    const container = scrollContainerRef.current
    if (!container) {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }

    const { scrollLeft, scrollWidth, clientWidth } = container
    const hasOverflow = scrollWidth > clientWidth
    
    setCanScrollLeft(hasOverflow && scrollLeft > 0)
    setCanScrollRight(hasOverflow && scrollLeft < scrollWidth - clientWidth - 1)
  }

  // Update scroll state on mount, resize, and scroll
  useEffect(() => {
    updateScrollState()
    
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => updateScrollState()
    const handleResize = () => updateScrollState()

    container.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleResize)

    // Use ResizeObserver for more accurate overflow detection
    const resizeObserver = new ResizeObserver(() => updateScrollState())
    resizeObserver.observe(container)

    return () => {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
    }
  }, [items.length]) // Re-check when items change

  // Don't render if no items
  if (items.length === 0) {
    return null
  }

  return (
    <div className="mt-3">
      <div 
        className="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Left fade gradient */}
        {canScrollLeft && (
          <div 
            className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white to-transparent pointer-events-none z-10"
            aria-hidden="true"
          />
        )}

        {/* Right fade gradient */}
        {canScrollRight && (
          <div 
            className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none z-10"
            aria-hidden="true"
          />
        )}

        {/* Optional chevrons (desktop only, on hover) */}
        {canScrollLeft && isHovered && (
          <div 
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 items-center justify-center bg-white/90 rounded-full shadow-sm pointer-events-none z-20"
            aria-hidden="true"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        )}

        {canScrollRight && isHovered && (
          <div 
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 items-center justify-center bg-white/90 rounded-full shadow-sm pointer-events-none z-20"
            aria-hidden="true"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}

        {/* Scrollable container */}
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto scrollbar-hide"
        >
          <div className="flex gap-2 pb-2 min-w-max">
            {items.map((symptom) => {
              const href = `/symptom/${symptom.id}${surgeryId ? `?surgery=${surgeryId}` : ''}`
              return (
                <Link
                  key={symptom.id}
                  href={href}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-full bg-white border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-400 hover:shadow-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2 focus-visible:bg-slate-100 focus-visible:border-slate-400 focus-visible:underline whitespace-nowrap transition-all duration-150"
                >
                  {symptom.name}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

