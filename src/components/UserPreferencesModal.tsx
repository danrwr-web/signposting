'use client'

import { FormEvent, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import ToggleSwitch from './ToggleSwitch'
import { CardStyle, useCardStyle } from '@/context/CardStyleContext'

interface UserPreferencesModalProps {
  isOpen: boolean
  onClose: () => void
}

type CardAppearanceOption = {
  value: CardStyle
  label: string
  description: string
}

const CARD_APPEARANCE_OPTIONS: readonly CardAppearanceOption[] = [
  {
    value: 'default',
    label: 'Modern',
    description: 'Clean white cards with rounded corners.'
  },
  {
    value: 'powerappsBlue',
    label: 'Blue',
    description: 'Classic blue cards that match the older design.'
  }
] as const

export default function UserPreferencesModal({ isOpen, onClose }: UserPreferencesModalProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const firstInputRef = useRef<HTMLInputElement | null>(null)

  const { cardStyle, setCardStyle, isSimplified, setIsSimplified } = useCardStyle()
  const { data: session } = useSession()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const headingId = useId()

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
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setErrorMessage('')
      setSuccessMessage('')
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === overlayRef.current) {
      handleClose()
    }
  }

  const handleClose = () => {
    if (isLoading) {
      return
    }

    onClose()
  }

  const handleCardStyleChange = (value: CardStyle) => {
    setCardStyle(value)
  }

  const handleSimplifiedChange = (value: boolean) => {
    setIsSimplified(value)
  }

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage('Please fill in all password fields.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password entries must match.')
      return
    }

    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.')
      return
    }

    if (currentPassword === newPassword) {
      setErrorMessage('New password must be different from the current password.')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })

      const data: { error?: string } = await response.json()

      if (response.ok) {
        setSuccessMessage('Password changed successfully.')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')

        window.setTimeout(() => {
          onClose()
          setSuccessMessage('')
        }, 1500)
      } else {
        setErrorMessage(data.error ?? 'We could not change your password. Please try again.')
      }
    } catch (error) {
      console.error('Password change error:', error)
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return createPortal(
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
        className="relative top-16 mx-auto w-full max-w-xl rounded-lg bg-white shadow-xl focus:outline-none"
      >
        <div className="max-h-[calc(100vh-6rem)] overflow-y-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={headingId} className="text-xl font-semibold text-slate-900">
                Preferences and settings
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Adjust how the library looks and manage your account details. These settings apply to this browser.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="rounded-full p-1 text-slate-500 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 disabled:opacity-60"
              aria-label="Close preferences"
            >
              <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-6 space-y-8 pb-2">
            <section>
              <h3 className="text-sm font-semibold text-slate-900">Card appearance</h3>
              <p className="mt-1 text-sm text-slate-600">
                Choose the main card styling.
              </p>
              <fieldset className="mt-4 space-y-3">
                <legend className="sr-only">Select a card appearance</legend>
                {CARD_APPEARANCE_OPTIONS.map(option => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 px-4 py-3 transition hover:border-nhs-blue focus-within:border-nhs-blue focus-within:ring-2 focus-within:ring-nhs-blue/40"
                  >
                    <input
                      ref={option.value === cardStyle ? firstInputRef : null}
                      type="radio"
                      name="cardStyle"
                      value={option.value}
                      checked={cardStyle === option.value}
                      onChange={() => handleCardStyleChange(option.value)}
                      className="mt-1 h-4 w-4 border-slate-300 text-nhs-blue focus:ring-nhs-blue"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{option.label}</span>
                      <span className="mt-0.5 block text-sm text-slate-600">{option.description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-slate-900">Simplified card layout</h3>
              <ToggleSwitch
                checked={isSimplified}
                onChange={handleSimplifiedChange}
                label="Show simplified symptom cards"
                description="Display only the symptom name and age badge. Helpful for quick scanning on larger screens."
              />
              <p className="mt-2 text-xs text-slate-500">
                When enabled, card colour follows the appearance you selected above but hides additional details until opened.
              </p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-slate-900">Change password</h3>
              <p className="mt-1 text-sm text-slate-600">
                Update your password for <span className="font-medium text-slate-900">{session?.user?.email ?? 'your account'}</span>.
              </p>
              <form className="mt-4 space-y-4" onSubmit={handlePasswordSubmit}>
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="currentPassword">
                    Current password
                  </label>
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={event => setCurrentPassword(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-nhs-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue/30"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="newPassword">
                    New password
                  </label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={event => setNewPassword(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-nhs-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue/30"
                    disabled={isLoading}
                  />
                  <p className="mt-1 text-xs text-slate-500">Must be at least 6 characters long.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="confirmPassword">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={event => setConfirmPassword(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-nhs-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue/30"
                    disabled={isLoading}
                  />
                </div>

                {errorMessage && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
                    {errorMessage}
                  </div>
                )}

                {successMessage && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
                    {successMessage}
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isLoading}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 disabled:opacity-60"
                  >
                    {isLoading ? 'Saving…' : 'Change password'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

