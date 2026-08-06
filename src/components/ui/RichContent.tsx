'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { ImageLightbox } from './ImageLightbox'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface RichContentProps {
  /**
   * Already-sanitized HTML — callers pass the output of the module's
   * `sanitizeAndFormat*Content` helper. It is not sanitized again here.
   */
  html: string
  /** Typography/layout classes for the wrapper (e.g. `prose prose-sm max-w-none`) */
  className?: string
  'data-testid'?: string
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/**
 * Baseline treatment for inline images, applied at every render site so they
 * look and behave the same wherever rich content appears.
 */
const IMAGE_CLASSES =
  '[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:cursor-zoom-in'

interface LightboxState {
  src: string
  alt: string
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * Renders sanitized rich-text HTML and makes any inline image clickable, opening
 * it full-screen in an `ImageLightbox`.
 *
 * The click affordance has to be wired up here rather than baked into the stored
 * markup: `sanitizeHtml.ts` only keeps `src`, `alt` and `width` on `<img>`, so
 * there is no way to attach a class, `data-*` attribute or wrapper element to an
 * image in the saved content. For the same reason the keyboard affordance
 * (`tabIndex` / `role` / `aria-label`) is applied to the rendered nodes in an
 * effect.
 */
export function RichContent({ html, className, 'data-testid': testId }: RichContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  // Make the rendered images focusable and announce them as buttons.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.querySelectorAll('img').forEach((img) => {
      // An image inside a link belongs to the link — leave it alone.
      if (img.closest('a')) return
      img.tabIndex = 0
      img.setAttribute('role', 'button')
      img.setAttribute(
        'aria-label',
        img.alt ? `Enlarge image: ${img.alt}` : 'Enlarge image'
      )
    })
  }, [html])

  const openFor = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false
    const img = target.closest('img')
    if (!img || !containerRef.current?.contains(img)) return false
    // Let links keep their normal behaviour.
    if (img.closest('a')) return false

    // Prefer the authored attribute so the lightbox uses the same relative,
    // same-origin URL the content does.
    setLightbox({ src: img.getAttribute('src') || img.src, alt: img.alt })
    return true
  }, [])

  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (openFor(e.target)) {
        e.preventDefault()
      }
    },
    [openFor]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      if (!(e.target instanceof HTMLImageElement)) return
      if (openFor(e.target)) {
        e.preventDefault()
      }
    },
    [openFor]
  )

  return (
    <>
      <div
        ref={containerRef}
        data-testid={testId}
        className={className ? `${className} ${IMAGE_CLASSES}` : IMAGE_CLASSES}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <ImageLightbox
        open={!!lightbox}
        src={lightbox?.src ?? null}
        alt={lightbox?.alt || undefined}
        onClose={() => setLightbox(null)}
      />
    </>
  )
}
