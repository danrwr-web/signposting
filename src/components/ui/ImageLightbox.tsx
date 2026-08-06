'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'

/* ------------------------------------------------------------------ */
/*  Zoom constants                                                     */
/* ------------------------------------------------------------------ */

/** Scale 1 is "fitted to the viewport", not the image's natural size. */
const MIN_SCALE = 1
const MAX_SCALE = 6
/** Multiplier applied by the zoom buttons and the +/- keys. */
const BUTTON_ZOOM_STEP = 1.5
/** Scale a double-tap/double-click jumps to from the fitted view. */
const DOUBLE_TAP_SCALE = 2.5
/** Pointer travel (px) above which a press counts as a drag, not a tap. */
const TAP_SLOP = 6

const FOCUSABLE = 'button:not([disabled])'

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
  /** Called when the lightbox should close (backdrop tap, close button, Escape) */
  onClose: () => void
}

interface Offset {
  x: number
  y: number
}

const ORIGIN: Offset = { x: 0, y: 0 }

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * Full-screen viewer for a single image, shown when a user clicks an image in
 * rendered content. The image opens fitted to the viewport and can then be
 * zoomed up to 6x and panned — by wheel, pinch, double-tap, the toolbar
 * buttons, or the +/-/0 keys.
 *
 * This deliberately does not reuse `Dialog`: that component forces a titled
 * header, a white `max-w-3xl` panel and a light backdrop, none of which suit an
 * image viewer. Focus handling, scroll lock and portalling follow `Dialog`, and
 * it uses the same `z-[10000]` so it layers over any dialog it is opened from.
 */
export function ImageLightbox({ open, src, alt, onClose }: ImageLightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<Element | null>(null)

  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState<Offset>(ORIGIN)
  const [isGesturing, setIsGesturing] = useState(false)

  // Live values for the native (non-passive) wheel listener, which is attached
  // once per open and must not close over stale state.
  const scaleRef = useRef(scale)
  scaleRef.current = scale
  const offsetRef = useRef(offset)
  offsetRef.current = offset

  // Stable ref so the effect doesn't re-run when callers pass inline arrows.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const isOpen = open && !!src
  const isZoomed = scale > MIN_SCALE

  /* ------ Pan/zoom maths --------------------------------------------- */

  /**
   * Keep the image overlapping the stage: it may be dragged until its edge
   * reaches the stage edge, and no further.
   */
  const clampOffset = useCallback((next: Offset, atScale: number): Offset => {
    const stage = stageRef.current
    const image = imageRef.current
    if (!stage || !image) return next

    // offsetWidth/Height are the laid-out (untransformed) size, so they give the
    // fitted dimensions before the scale transform is applied.
    const maxX = Math.max(0, (image.offsetWidth * atScale - stage.clientWidth) / 2)
    const maxY = Math.max(0, (image.offsetHeight * atScale - stage.clientHeight) / 2)

    return { x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) }
  }, [])

  /**
   * Zoom to `nextScale`, keeping the point under `anchor` (client coordinates)
   * visually fixed. Without an anchor the stage centre is used.
   *
   * The image is centred and transformed as `translate(offset) scale(scale)`, so
   * a point at image-local coordinate `u` sits at `offset + scale * u` relative
   * to the stage centre. Solving for the offset that keeps `u` under the anchor
   * gives `next = anchor - (nextScale / scale) * (anchor - offset)`.
   */
  const zoomTo = useCallback(
    (nextScale: number, anchor?: { x: number; y: number }) => {
      const stage = stageRef.current
      const clamped = clamp(nextScale, MIN_SCALE, MAX_SCALE)
      const current = scaleRef.current

      if (clamped === MIN_SCALE) {
        setScale(MIN_SCALE)
        setOffset(ORIGIN)
        return
      }

      let anchorX = 0
      let anchorY = 0
      if (anchor && stage) {
        const rect = stage.getBoundingClientRect()
        anchorX = anchor.x - (rect.left + rect.width / 2)
        anchorY = anchor.y - (rect.top + rect.height / 2)
      }

      const ratio = clamped / current
      const previous = offsetRef.current
      const next = {
        x: anchorX - ratio * (anchorX - previous.x),
        y: anchorY - ratio * (anchorY - previous.y),
      }

      setScale(clamped)
      setOffset(clampOffset(next, clamped))
    },
    [clampOffset]
  )

  const resetZoom = useCallback(() => {
    setScale(MIN_SCALE)
    setOffset(ORIGIN)
  }, [])

  /* ------ Reset when the viewed image changes ------------------------ */
  useEffect(() => {
    resetZoom()
  }, [src, isOpen, resetZoom])

  /* ------ Focus management, keyboard & scroll lock ------------------- */
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

      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        e.stopPropagation()
        zoomTo(scaleRef.current * BUTTON_ZOOM_STEP)
        return
      }

      if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        e.stopPropagation()
        zoomTo(scaleRef.current / BUTTON_ZOOM_STEP)
        return
      }

      if (e.key === '0') {
        e.preventDefault()
        e.stopPropagation()
        resetZoom()
        return
      }

      // Keep Tab inside the toolbar.
      if (e.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) return

        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (focusable.length === 0) {
          e.preventDefault()
          e.stopPropagation()
          return
        }

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement as HTMLElement | null

        e.stopPropagation()
        if (!e.shiftKey && (active === last || !dialog.contains(active))) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && (active === first || !dialog.contains(active))) {
          e.preventDefault()
          last.focus()
        }
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
  }, [isOpen, zoomTo, resetZoom])

  /* ------ Wheel zoom ------------------------------------------------- */
  useEffect(() => {
    const stage = stageRef.current
    if (!isOpen || !stage) return

    // React attaches wheel listeners passively at the root, so preventDefault()
    // needs a native non-passive listener here to stop the page zooming instead.
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = Math.exp(-e.deltaY / 300)
      zoomTo(scaleRef.current * factor, { x: e.clientX, y: e.clientY })
    }

    stage.addEventListener('wheel', handleWheel, { passive: false })
    return () => stage.removeEventListener('wheel', handleWheel)
  }, [isOpen, zoomTo])

  /* ------ Pointer handling (pan, pinch, tap-to-close) ---------------- */

  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchDistanceRef = useRef<number | null>(null)
  const panStartRef = useRef<{ x: number; y: number; offset: Offset } | null>(null)
  const movedRef = useRef(false)
  /**
   * Whether the press started on the image. `pointerup` can't tell us: once the
   * stage takes pointer capture (below), every later event for that pointer is
   * retargeted to the stage, so a tap on the image would look like a tap on
   * empty space and dismiss the viewer.
   */
  const downOnImageRef = useRef(false)

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointersRef.current.size === 1) {
        movedRef.current = false
        // Read the target before taking capture — pointerdown's own target is real.
        downOnImageRef.current = e.target instanceof HTMLImageElement
        panStartRef.current = { x: e.clientX, y: e.clientY, offset: offsetRef.current }
        if (scaleRef.current > MIN_SCALE) {
          e.currentTarget.setPointerCapture?.(e.pointerId)
          setIsGesturing(true)
        }
      } else {
        // A second finger starts a pinch — stop panning and remember the span.
        panStartRef.current = null
        setIsGesturing(true)
        movedRef.current = true
        pinchDistanceRef.current = null
      }
    },
    []
  )

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const pointers = pointersRef.current
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointers.size >= 2) {
        const [a, b] = Array.from(pointers.values())
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        const previous = pinchDistanceRef.current
        pinchDistanceRef.current = distance

        if (previous && previous > 0) {
          zoomTo(scaleRef.current * (distance / previous), {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
          })
        }
        return
      }

      const start = panStartRef.current
      if (!start) return

      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (Math.hypot(dx, dy) > TAP_SLOP) {
        movedRef.current = true
      }

      if (scaleRef.current > MIN_SCALE) {
        setOffset(
          clampOffset({ x: start.offset.x + dx, y: start.offset.y + dy }, scaleRef.current)
        )
      }
    },
    [clampOffset, zoomTo]
  )

  const endPointer = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) {
      pinchDistanceRef.current = null
    }
    if (pointersRef.current.size === 0) {
      panStartRef.current = null
      setIsGesturing(false)
    }
  }, [])

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const wasTap = !movedRef.current && pointersRef.current.size === 1
      endPointer(e)

      // A tap on empty stage — anywhere but the image — dismisses the viewer.
      if (wasTap && !downOnImageRef.current) {
        onCloseRef.current()
      }
    },
    [endPointer]
  )

  const handleDoubleClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      // Same source of truth as the tap check: capture is released by the time
      // dblclick fires, but don't depend on that ordering.
      if (!downOnImageRef.current) return
      if (scaleRef.current > MIN_SCALE) {
        resetZoom()
      } else {
        zoomTo(DOUBLE_TAP_SCALE, { x: e.clientX, y: e.clientY })
      }
    },
    [resetZoom, zoomTo]
  )

  if (!isOpen || !src) return null

  const zoomPercent = Math.round(scale * 100)
  const toolbarButton =
    'rounded-full bg-slate-900/60 p-2 text-white transition-colors hover:bg-slate-900/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40 disabled:hover:bg-slate-900/60'

  const lightbox = (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt ? `Enlarged image: ${alt}` : 'Enlarged image'}
      className="fixed inset-0 z-[10000] flex flex-col"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/80 animate-dialog-overlay-in"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Toolbar */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <span className="rounded-full bg-slate-900/60 px-3 py-2 text-sm tabular-nums text-white">
          {zoomPercent}%
        </span>
        <button
          type="button"
          onClick={() => zoomTo(scale / BUTTON_ZOOM_STEP)}
          disabled={scale <= MIN_SCALE}
          className={toolbarButton}
          aria-label="Zoom out"
          title="Zoom out (-)"
        >
          <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M4 10h12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => zoomTo(scale * BUTTON_ZOOM_STEP)}
          disabled={scale >= MAX_SCALE}
          className={toolbarButton}
          aria-label="Zoom in"
          title="Zoom in (+), or scroll / pinch on the image"
        >
          <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M10 4v12M4 10h12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={resetZoom}
          disabled={!isZoomed}
          className={toolbarButton}
          aria-label="Reset zoom"
          title="Reset zoom (0)"
        >
          <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M4 8V4h4M16 12v4h-4M16 8V4h-4M4 12v4h4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className={toolbarButton}
          aria-label="Close image"
          title="Close (Esc)"
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
      </div>

      {/* Stage: holds the image and owns the pan/zoom gestures. */}
      <div
        ref={stageRef}
        data-testid="image-lightbox-stage"
        className="relative flex flex-1 touch-none items-center justify-center overflow-hidden p-4"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={endPointer}
        onDoubleClick={handleDoubleClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={src}
          alt={alt ?? ''}
          draggable={false}
          className={`max-h-full max-w-full select-none rounded object-contain shadow-2xl ${
            isGesturing ? 'cursor-grabbing' : isZoomed ? 'cursor-grab' : 'cursor-zoom-in'
          }`}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            // Animate button/keyboard steps, but never a drag or a pinch.
            transition: isGesturing ? undefined : 'transform 150ms ease-out',
          }}
        />
      </div>

      {alt && (
        <div className="relative shrink-0 px-4 pb-4 text-center text-sm text-white/80">
          {alt}
        </div>
      )}
    </div>
  )

  // Use portal to avoid stacking-context issues
  if (typeof document !== 'undefined') {
    return createPortal(lightbox, document.body)
  }

  return lightbox
}
