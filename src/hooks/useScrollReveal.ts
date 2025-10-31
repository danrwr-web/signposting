"use client"

import { useEffect, useMemo, type RefCallback } from 'react'

type ScrollRevealOptions = {
  rootMargin?: string
  threshold?: number
}

/**
 * Adds a lightweight, accessible scroll-reveal effect to multiple elements.
 * - Uses a single IntersectionObserver to observe many nodes
 * - Respects prefers-reduced-motion
 * - Adds `sr-init` initially, then `sr-visible` when revealed
 */
export function useScrollReveal(options: ScrollRevealOptions = {}) {
  const isReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  const observer = useMemo(() => {
    if (typeof window === 'undefined') return null
    if (isReducedMotion) return null
    return new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement
            target.classList.add('sr-visible')
            obs.unobserve(target)
          }
        }
      },
      {
        root: null,
        rootMargin: options.rootMargin ?? '0px 0px -10% 0px',
        threshold: options.threshold ?? 0.1,
      }
    )
  }, [isReducedMotion, options.rootMargin, options.threshold])

  useEffect(() => {
    return () => {
      observer?.disconnect()
    }
  }, [observer])

  /**
   * Callback ref you can assign to any element you want to reveal.
   * Safe to reuse across many elements.
   */
  const register: RefCallback<HTMLElement> = (el) => {
    if (!el) return
    const node = el
    node.classList.add('sr-init')
    if (!observer || isReducedMotion) {
      // Show immediately when reduced motion is requested
      node.classList.add('sr-visible')
      return
    }
    observer.observe(node)
  }

  return { register }
}


