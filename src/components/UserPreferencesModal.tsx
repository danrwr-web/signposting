'use client'

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import ToggleSwitch from './ToggleSwitch'
import ChangePasswordDialog from './ChangePasswordDialog'
import { CardStyle, HeaderLayout, HighRiskStyle, useCardStyle } from '@/context/CardStyleContext'
import toast from 'react-hot-toast'

interface UserPreferencesModalProps {
  isOpen: boolean
  onClose: () => void
}

interface RadioCardProps {
  name: string
  value: string
  checked: boolean
  onChange: (v: string) => void
  title: string
  help?: string
  preview?: React.ReactNode
}

const RadioCard = React.forwardRef<HTMLInputElement, RadioCardProps>(
  ({ name, value, checked, onChange, title, help, preview }, ref) => {
    return (
      <label
        className={[
          'rounded-xl border p-3 cursor-pointer flex items-start gap-3 transition',
          checked
            ? 'border-nhs-blue ring-2 ring-nhs-blue/20'
            : 'border-slate-300 hover:border-slate-400'
        ].join(' ')}
      >
        <input
          ref={ref}
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={() => onChange(value)}
          className="sr-only"
        />
      <div className="w-6 h-6 rounded-md overflow-hidden ring-1 ring-slate-300 flex items-center justify-center flex-shrink-0">
        {preview}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-900">{title}</div>
        {help && <div className="text-xs text-slate-600 mt-0.5">{help}</div>}
      </div>
    </label>
    )
  }
)

RadioCard.displayName = 'RadioCard'

export default function UserPreferencesModal({ isOpen, onClose }: UserPreferencesModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const firstInputRef = useRef<HTMLInputElement | null>(null)

  const {
    cardStyle,
    setCardStyle,
    isSimplified,
    setIsSimplified,
    headerLayout,
    setHeaderLayout,
    highRiskStyle,
    setHighRiskStyle,
    resetPrefs
  } = useCardStyle()

  const { data: session } = useSession()
  const [showChangePassword, setShowChangePassword] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const headingId = useId()
  const appearanceId = useId()
  const headerId = useId()
  const highRiskId = useId()

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose()
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
        )

        if (focusableElements.length === 0) {
          return
        }

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        } else if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    if (firstInputRef.current) {
      firstInputRef.current.focus()
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleClose])

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === overlayRef.current) {
      handleClose()
    }
  }

  const showSavedToast = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      toast.success('Saved', { duration: 1500 })
    }, 300)
  }

  const handleCardStyleChange = (value: CardStyle) => {
    setCardStyle(value)
    showSavedToast()
  }

  const handleSimplifiedChange = (value: boolean) => {
    setIsSimplified(value)
    showSavedToast()
  }

  const handleHeaderLayoutChange = (value: HeaderLayout) => {
    setHeaderLayout(value)
    showSavedToast()
  }

  const handleHighRiskStyleChange = (value: HighRiskStyle) => {
    setHighRiskStyle(value)
    showSavedToast()
  }

  const handleReset = () => {
    resetPrefs()
    toast.success('Reset to defaults', { duration: 2000 })
  }

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  if (!isOpen) {
    return (
      <>
        <ChangePasswordDialog isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
      </>
    )
  }

  return (
    <>
      {createPortal(
        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          className="fixed inset-0 z-[9999] bg-slate-900/40"
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            className="relative top-16 mx-auto w-full max-w-2xl rounded-lg bg-white shadow-xl focus:outline-none"
          >
            <div className="max-h-[calc(100vh-6rem)] overflow-y-auto px-6 py-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 id={headingId} className="text-xl font-semibold text-slate-900">
                    Preferences
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    These settings apply to this browser.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-sm text-slate-600 hover:text-slate-900 underline focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 rounded"
                  >
                    Reset to defaults
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-full p-1 text-slate-500 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2"
                    aria-label="Close preferences"
                  >
                    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Appearance */}
                <fieldset className="space-y-3">
                  <legend id={appearanceId} className="text-sm font-semibold text-slate-700 mb-3">
                    Appearance
                  </legend>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Card theme</label>
                      <div className="space-y-2">
                        <RadioCard
                          ref={firstInputRef}
                          name="cardTheme"
                          value="default"
                          checked={cardStyle === 'default'}
                          onChange={handleCardStyleChange}
                          title="Modern (white)"
                          help="Clean white cards with rounded corners."
                          preview={<div className="w-full h-full bg-white rounded shadow-sm border border-slate-200" />}
                        />
                        <RadioCard
                          name="cardTheme"
                          value="powerappsBlue"
                          checked={cardStyle === 'powerappsBlue'}
                          onChange={handleCardStyleChange}
                          title="Classic (blue)"
                          help="Blue cards that match the older design."
                          preview={
                            <div className="w-full h-full bg-blue-600 rounded flex items-center justify-center">
                              <span className="text-[7px] text-white font-medium px-0.5">Adult</span>
                            </div>
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <ToggleSwitch
                        checked={isSimplified}
                        onChange={handleSimplifiedChange}
                        label="Quick-scan cards"
                        description="Show only the symptom name and age badge. Ideal for fast scanning."
                        aria-describedby={`${appearanceId}-simplified-help`}
                      />
                      <p id={`${appearanceId}-simplified-help`} className="sr-only">
                        When enabled, card colour follows the appearance you selected above but hides additional details until opened.
                      </p>
                    </div>
                  </div>
                </fieldset>

                {/* Header & filters */}
                <fieldset className="space-y-3">
                  <legend id={headerId} className="text-sm font-semibold text-slate-700 mb-3">
                    Header & filters
                  </legend>
                  <div className="space-y-2">
                    <RadioCard
                      name="headerLayout"
                      value="classic"
                      checked={headerLayout === 'classic'}
                      onChange={handleHeaderLayoutChange}
                      title="Classic"
                      help="Search and filters arranged in a single toolbar."
                    />
                    <RadioCard
                      name="headerLayout"
                      value="split"
                      checked={headerLayout === 'split'}
                      onChange={handleHeaderLayoutChange}
                      title="Split (filters left, high-risk right)"
                      help="Puts filters under the search and high-risk buttons in a right panel."
                    />
                  </div>
                </fieldset>

                {/* High-risk buttons */}
                <fieldset className="space-y-3 lg:col-span-2">
                  <legend id={highRiskId} className="text-sm font-semibold text-slate-700 mb-3">
                    High-risk buttons
                  </legend>
                  {headerLayout === 'split' ? (
                    <div className="space-y-2">
                      <RadioCard
                        name="highRiskStyle"
                        value="pill"
                        checked={(highRiskStyle ?? 'pill') === 'pill'}
                        onChange={handleHighRiskStyleChange}
                        title="Pill (default)"
                        help="Rounded pills."
                        preview={<div className="w-full h-full bg-red-600 rounded-full border-2 border-red-700" />}
                      />
                      <RadioCard
                        name="highRiskStyle"
                        value="tile"
                        checked={highRiskStyle === 'tile'}
                        onChange={handleHighRiskStyleChange}
                        title="Tile"
                        help="Squared tiles with a subtle border."
                        preview={<div className="w-full h-full bg-red-50 border border-red-200 rounded-xl" />}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">
                      Available when Header layout is set to Split.
                    </p>
                  )}
                </fieldset>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowChangePassword(true)}
                  className="text-sm text-slate-600 hover:text-slate-900 underline focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 rounded"
                >
                  Change password…
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ChangePasswordDialog isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </>
  )
}
