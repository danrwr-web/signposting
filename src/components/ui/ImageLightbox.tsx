'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ImageLightboxProps {
  /** Whether the lightbox is open */
  open: boolean
  /** Image source (same-origin; auth-gated routes work because cookies attach) */
  src: string | null
  /** Alt text — also used as the caption and accessible label */
  alt?: string
  /** Called when the lightbox should close (backdrop click, close button, Escape) */
  onClose: () => void
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * Full-screen viewer for a single image, shown when a user clicks an image in
 * rendered content. The image is displayed at its natural size, scaled down to
 * fit the viewport — there is no zoom or pan.
 *
 * This deliberately does not reuse `Dialog`: that component forces a titled
 * header, a white `max-w-3xl` panel and a light backdrop, none of which suit an
 * image viewer. Focus handling, scroll lock and portalling follow `Dialog`, and
 * it uses the same `z-[10000]` so it layers over any dialog it is opened from.
 */
export function ImageLightbox({ open, src, alt, onClose }: ImageLightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<Element | null>(null)

  // Stable ref so the effect doesn't re-run when callers pass inline arrows.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const isOpen = open && !!src

  useEffect(() => {
    if (!isOpen) return

    previousFocusRef.current = document.activeElement

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    closeButtonRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCloseRef.current()
        return
      }

      // The close button is the only focusable element, so Tab stays put.
      if (e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        closeButtonRef.current?.focus()
      }
    }

    // Capture phase: an open lightbox is always the topmost layer, so it must win
    // over the Escape/Tab handlers of any dialog it was opened from — those listen
    // on `document` in the bubble phase, and `stopPropagation` here keeps one
    // Escape press from closing the dialog underneath as well.
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.body.style.overflow = prevOverflow
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen])

  if (!isOpen || !src) return null

  const lightbox = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt ? `Enlarged image: ${alt}` : 'Enlarged image'}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/80 animate-dialog-overlay-in"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Close button */}
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-slate-900/60 p-2 text-white transition-colors hover:bg-slate-900/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        aria-label="Close image"
      >
        <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M5 5l10 10M15 5 5 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Image + caption. Clicking the image itself must not close the viewer. */}
      <figure
        className="relative flex flex-col items-center gap-3 animate-dialog-content-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? ''}
          className="max-h-[85vh] max-w-[95vw] rounded object-contain shadow-2xl"
        />
        {alt && (
          <figcaption className="max-w-[95vw] text-center text-sm text-white/80">
            {alt}
          </figcaption>
        )}
      </figure>
    </div>
  )

  // Use portal to avoid stacking-context issues
  if (typeof document !== 'undefined') {
    return createPortal(lightbox, document.body)
  }

  return lightbox
}
