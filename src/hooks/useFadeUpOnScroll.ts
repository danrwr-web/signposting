"use client"

import { useEffect, useMemo, useRef, useState, type RefCallback } from 'react'

type FadeUpOptions = {
  rootMargin?: string
  threshold?: number
  staggerDelay?: number
}

/**
 * Lightweight hook for fade-up on scroll with optional stagger delay.
 * Uses IntersectionObserver and respects prefers-reduced-motion.
 * Returns a ref callback and visibility state.
 */
export function useFadeUpOnScroll(options: FadeUpOptions = {}) {
  const {
    rootMargin = '0px 0px -10% 0px',
    threshold = 0.1,
    staggerDelay = 0,
  } = options

  const [isVisible, setIsVisible] = useState(false)
  const elementRef = useRef<HTMLElement | null>(null)
  const hasAnimatedRef = useRef(false)

  const isReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    // Show immediately if reduced motion is preferred
    if (isReducedMotion) {
      setIsVisible(true)
      return
    }

    let timeoutId: NodeJS.Timeout | null = null

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAnimatedRef.current) {
            hasAnimatedRef.current = true
            
            // Apply stagger delay if specified
            if (staggerDelay > 0) {
              timeoutId = setTimeout(() => {
                setIsVisible(true)
              }, staggerDelay)
            } else {
              setIsVisible(true)
            }
            
            observer.unobserve(entry.target)
          }
        }
      },
      {
        root: null,
        rootMargin,
        threshold,
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [rootMargin, threshold, staggerDelay, isReducedMotion])

  const ref: RefCallback<HTMLElement> = (el) => {
    elementRef.current = el
  }

  return { ref, isVisible: isReducedMotion || isVisible }
}

