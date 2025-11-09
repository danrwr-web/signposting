'use client'

import { useEffect, useId, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  description?: string
  initialFocusRef?: React.RefObject<HTMLElement>
  widthClassName?: string
}

export default function Modal({
  title,
  onClose,
  children,
  description,
  initialFocusRef,
  widthClassName = 'max-w-xl'
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<Element | null>(null)
  const titleId = useId()
  const descriptionId = description ? `${titleId}-description` : undefined

  useEffect(() => {
    previousFocusRef.current = document.activeElement
    const focusTarget =
      initialFocusRef?.current ||
      dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ||
      closeButtonRef.current

    focusTarget?.focus()

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) {
          return
        }

        const focusableNodes = Array.from(
          dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((node) => node.tabIndex !== -1 && !node.hasAttribute('disabled'))

        if (focusableNodes.length === 0) {
          event.preventDefault()
          return
        }

        const first = focusableNodes[0]
        const last = focusableNodes[focusableNodes.length - 1]
        const isShiftPressed = event.shiftKey
        const activeElement = document.activeElement as HTMLElement | null

        if (!activeElement) {
          return
        }

        if (!isShiftPressed && activeElement === last) {
          event.preventDefault()
          first.focus()
          return
        }

        if (isShiftPressed && activeElement === first) {
          event.preventDefault()
          last.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeydown)
    return () => {
      document.removeEventListener('keydown', handleKeydown)
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus()
      }
    }
  }, [initialFocusRef, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className={`relative w-full ${widthClassName} max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl focus:outline-none`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div className="flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-nhs-dark-blue">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-2 text-sm text-nhs-grey">
                {description}
              </p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-nhs-grey hover:text-nhs-dark-grey focus:outline-none focus:ring-2 focus:ring-nhs-blue"
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
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

