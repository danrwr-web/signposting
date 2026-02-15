'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Dialog, Button, Input, AlertBanner } from '@/components/ui'

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
  const firstInputRef = useRef<HTMLInputElement | null>(null)

  const { data: session } = useSession()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submittingRef = useRef(submitting)

  const strength = passwordStrength(next)

  useEffect(() => {
    submittingRef.current = submitting
  }, [submitting])

  const handleClose = useCallback(() => {
    if (submittingRef.current) {
      return
    }
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) {
      setCurrent('')
      setNext('')
      setConfirm('')
      setError(null)
    }
  }, [isOpen])

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

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      title="Change password"
      description={`Update your password for ${session?.user?.email ?? 'your account'}.`}
      width="md"
      initialFocusRef={firstInputRef}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="change-password-form"
            loading={submitting}
          >
            {submitting ? 'Saving…' : 'Change password'}
          </Button>
        </>
      }
    >
      {error && (
        <AlertBanner variant="error" className="mb-3">
          {error}
        </AlertBanner>
      )}

      <form id="change-password-form" onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="currentPassword">
            Current password
          </label>
          <Input
            ref={firstInputRef}
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={e => setCurrent(e.target.value)}
            disabled={submitting}
            className="mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="newPassword">
            New password
          </label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            value={next}
            onChange={e => setNext(e.target.value)}
            disabled={submitting}
            className="mt-1"
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
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            disabled={submitting}
            className="mt-1"
          />
        </div>
      </form>
    </Dialog>
  )
}
