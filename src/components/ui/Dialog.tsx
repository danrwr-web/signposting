'use client'

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

/* ------------------------------------------------------------------ */
/*  Focusable selector                                                 */
/* ------------------------------------------------------------------ */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/* ------------------------------------------------------------------ */
/*  Width presets                                                       */
/* ------------------------------------------------------------------ */

const widthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
} as const

export type DialogWidth = keyof typeof widthClasses

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface DialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Called when the dialog should close (backdrop click, Escape) */
  onClose: () => void
  /** Dialog title (rendered in header, linked via aria-labelledby) */
  title: string
  /** Optional description below the title */
  description?: string
  /** Width preset (default: 'xl') */
  width?: DialogWidth
  /** Ref to the element that should receive initial focus */
  initialFocusRef?: React.RefObject<HTMLElement | null>
  /** Main dialog content */
  children: ReactNode
  /** Optional sticky footer (action buttons, etc.) */
  footer?: ReactNode
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Dialog({
  open,
  onClose,
  title,
  description,
  width = 'xl',
  initialFocusRef,
  children,
  footer,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<Element | null>(null)
  const titleId = useId()
  const descId = description ? `${titleId}-desc` : undefined

  /* ------ Focus management & keyboard -------------------------------- */
  useEffect(() => {
    if (!open) return

    // Capture previous focus target
    previousFocusRef.current = document.activeElement

    // Lock body scroll
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Initial focus
    requestAnimationFrame(() => {
      const target =
        initialFocusRef?.current ??
        dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
        closeButtonRef.current
      target?.focus()
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) return

        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(FOCUSABLE)
        ).filter((n) => n.tabIndex !== -1 && !n.hasAttribute('disabled'))

        if (focusable.length === 0) {
          e.preventDefault()
          return
        }

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement as HTMLElement | null

        if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = prevOverflow
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
      }
    }
  }, [open, initialFocusRef, onClose])

  /* ------ Render ----------------------------------------------------- */
  if (!open) return null

  const dialog = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 animate-dialog-overlay-in"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dialog panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className={[
          'relative w-full',
          widthClasses[width],
          'max-h-[90vh] flex flex-col',
          'rounded-2xl bg-white shadow-xl',
          'animate-dialog-content-in',
          'focus:outline-none',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 shrink-0">
          <div className="flex-1 min-w-0">
            <h2
              id={titleId}
              className="text-lg font-semibold text-nhs-dark-blue"
            >
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-nhs-grey">
                {description}
              </p>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-nhs-grey hover:text-nhs-dark-grey hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue"
            aria-label="Close dialog"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
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

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Optional footer */}
        {footer && (
          <div className="border-t border-gray-200 px-6 py-4 shrink-0 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  // Use portal to avoid stacking-context issues
  if (typeof document !== 'undefined') {
    return createPortal(dialog, document.body)
  }

  return dialog
}
