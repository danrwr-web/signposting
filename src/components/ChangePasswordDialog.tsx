'use client'

import { FormEvent, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

interface ChangePasswordDialogProps {
  isOpen: boolean
  onClose: () => void
}

function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const label = score <= 1 ? 'Weak' : score === 2 ? 'Fair' : 'Strong'
  return { score, label }
}

function StrengthBar({ value }: { value: number }) {
  return (
    <div className="mt-1 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
      <div
        className={[
          'h-full transition-all',
          value <= 1 ? 'bg-red-500 w-1/4' : value === 2 ? 'bg-amber-500 w-2/4' : 'bg-green-600 w-4/5'
        ].join(' ')}
      />
    </div>
  )
}

export default function ChangePasswordDialog({ isOpen, onClose }: ChangePasswordDialogProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const firstInputRef = useRef<HTMLInputElement | null>(null)

  const { data: session } = useSession()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const headingId = useId()
  const strength = passwordStrength(next)

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
      setCurrent('')
      setNext('')
      setConfirm('')
      setError(null)
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
    if (submitting) {
      return
    }
    onClose()
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!current || !next || !confirm) {
      setError('Please complete all fields.')
      return
    }

    if (next.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (next === current) {
      setError('New password must be different to your current password.')
      return
    }

    if (next !== confirm) {
      setError('Passwords do not match.')
      return
    }

    try {
      setSubmitting(true)

      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: current,
          newPassword: next
        })
      })

      const data: { error?: string } = await response.json()

      if (response.ok) {
        toast.success('Password updated.')
        handleClose()
      } else {
        setError(data.error ?? 'Something went wrong. Please try again.')
      }
    } catch (err) {
      console.error('Password change error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
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
        className="relative top-16 mx-auto w-full max-w-md rounded-lg bg-white shadow-xl focus:outline-none"
      >
        <div className="px-6 py-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 id={headingId} className="text-xl font-semibold text-slate-900">
                Change password
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Update your password for <span className="font-medium">{session?.user?.email ?? 'your account'}</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="rounded-full p-1 text-slate-500 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 disabled:opacity-60"
              aria-label="Close dialog"
            >
              <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="currentPassword">
                Current password
              </label>
              <input
                ref={firstInputRef}
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={e => setCurrent(e.target.value)}
                disabled={submitting}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-nhs-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue/30 disabled:opacity-60"
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
                value={next}
                onChange={e => setNext(e.target.value)}
                disabled={submitting}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-nhs-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue/30 disabled:opacity-60"
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-slate-600">At least 8 characters.</span>
                <span className="text-xs font-medium">{strength.label}</span>
              </div>
              <StrengthBar value={strength.score} />
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
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                disabled={submitting}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-nhs-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue/30 disabled:opacity-60"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Change password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  )
}

