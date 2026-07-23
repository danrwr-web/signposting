'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { formatRelativeDate } from '@/lib/formatRelativeDate'
import { getUserInitials } from '@/lib/getUserInitials'
import { Badge, Button, Dialog, FormField, Input, Select } from '@/components/ui'
import HandbookToggle from './HandbookToggle'
import type { Membership, PendingAction } from './types'

interface MemberDetailPanelProps {
  membership: Membership | null
  surgeryId: string
  surgeryName: string
  handbookEnabled: boolean
  lastActive: string | null
  onClose: () => void
  /** Routes destructive actions to the parent's ConfirmDialog */
  onRequestConfirm: (action: PendingAction) => void
}

export default function MemberDetailPanel({
  membership,
  surgeryId,
  surgeryName,
  handbookEnabled,
  lastActive,
  onClose,
  onRequestConfirm,
}: MemberDetailPanelProps) {
  const router = useRouter()
  const [details, setDetails] = useState({ name: '', role: 'STANDARD' })
  const [savingDetails, setSavingDetails] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [isResettingPassword, setIsResettingPassword] = useState(false)

  const userId = membership?.user.id ?? null

  // Re-seed the form when a different member opens. Deliberately not on every
  // `membership` change — router.refresh() after a toggle delivers a fresh
  // object and must not clobber in-progress detail edits.
  useEffect(() => {
    if (!userId || !membership) return
    setDetails({
      name: membership.user.name || '',
      role: membership.role,
    })
    setShowResetPassword(false)
    setNewPassword('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  if (!membership) return null

  const isDefaultSurgery = membership.user.defaultSurgeryId === surgeryId

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingDetails(true)
    try {
      const response = await fetch(`/api/s/${surgeryId}/members/${membership.user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: details.name,
          role: details.role,
        }),
      })

      if (response.ok) {
        toast.success('User updated')
        router.refresh()
      } else {
        const error = await response.json()
        toast.error(`Error updating user: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error('Failed to update user. Please try again.')
    } finally {
      setSavingDetails(false)
    }
  }

  const handleToggleAdminToolkitWrite = async (targetUserId: string, nextValue: boolean) => {
    try {
      const response = await fetch(`/api/s/${surgeryId}/members/${targetUserId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminToolkitWrite: nextValue,
        }),
      })

      if (response.ok) {
        router.refresh()
      } else {
        const error = await response.json()
        toast.error(`Failed to update Practice Handbook write access: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating admin toolkit write:', error)
      toast.error('Failed to update Practice Handbook write access')
    }
  }

  const handleSetDefaultSurgery = async () => {
    try {
      const response = await fetch(`/api/s/${surgeryId}/members/${membership.user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setAsDefault: true,
        }),
      })

      if (response.ok) {
        toast.success('Default surgery updated')
        router.refresh()
      } else {
        const error = await response.json()
        toast.error(`Failed to set default surgery: ${error.error}`)
      }
    } catch (error) {
      console.error('Error setting default surgery:', error)
      toast.error('Failed to set default surgery')
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsResettingPassword(true)

    try {
      const response = await fetch(`/api/s/${surgeryId}/members/${membership.user.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword: newPassword,
        }),
      })

      if (response.ok) {
        toast.success('Password reset successfully')
        setShowResetPassword(false)
        setNewPassword('')
      } else {
        const error = await response.json()
        toast.error(`Failed to reset password: ${error.error}`)
      }
    } catch (error) {
      console.error('Error resetting password:', error)
      toast.error('Failed to reset password')
    } finally {
      setIsResettingPassword(false)
    }
  }

  const lastActiveDate = lastActive ? new Date(lastActive) : null

  return (
    <Dialog
      open
      onClose={onClose}
      title={membership.user.name || membership.user.email}
      width="3xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {/* Identity header */}
      <div className="flex items-center gap-4 pb-5 border-b border-gray-200">
        <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center text-lg font-medium text-gray-600 flex-shrink-0">
          {getUserInitials(membership.user.name, membership.user.email)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-semibold text-gray-900 truncate">
              {membership.user.name || 'No name set'}
            </span>
            {membership.role === 'ADMIN' && (
              <Badge color="green" size="sm" pill={false}>
                Practice admin
              </Badge>
            )}
            {isDefaultSurgery && (
              <Badge color="gray" size="sm" pill={false}>
                Default surgery
              </Badge>
            )}
          </div>
          <div className="text-sm text-gray-500 truncate">{membership.user.email}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Last active{' '}
            {lastActiveDate ? (
              formatRelativeDate(lastActiveDate)
            ) : (
              <span className="text-amber-600">never</span>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <form onSubmit={handleSaveDetails} className="pt-5 pb-6 border-b border-gray-200">
        <h4 className="text-md font-medium text-gray-900 mb-3">Details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <FormField label="Email Address" htmlFor="member-email">
            <Input
              type="email"
              id="member-email"
              value={membership.user.email}
              disabled
              className="bg-gray-100 text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
          </FormField>
          <FormField label="Full Name" htmlFor="member-name">
            <Input
              id="member-name"
              value={details.name}
              onChange={(e) => setDetails({ ...details, name: e.target.value })}
              placeholder="John Doe"
            />
          </FormField>
          <FormField label="Role" htmlFor="member-role">
            <Select
              id="member-role"
              value={details.role}
              onChange={(e) => setDetails({ ...details, role: e.target.value })}
            >
              <option value="STANDARD">Standard User</option>
              <option value="ADMIN">Practice admin</option>
            </Select>
          </FormField>
        </div>
        <Button type="submit" size="sm" loading={savingDetails}>
          Save changes
        </Button>
      </form>

      {/* Permissions */}
      {handbookEnabled && (
        <div className="pt-5 pb-6 border-b border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-2">Permissions</h4>
          <div className="flex items-center gap-3">
            <HandbookToggle membership={membership} onToggle={handleToggleAdminToolkitWrite} />
            <div>
              <div className="text-sm text-gray-700">Practice Handbook write access</div>
              {membership.role === 'ADMIN' && (
                <div className="text-xs text-gray-400">Practice admins can always edit.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Default surgery */}
      <div className="pt-5 pb-6 border-b border-gray-200">
        <h4 className="text-md font-medium text-gray-900 mb-2">Default surgery</h4>
        {isDefaultSurgery ? (
          <p className="text-sm text-gray-600">
            {surgeryName} is this user&apos;s default surgery — they land here when they log in.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-600">
              Make {surgeryName} the surgery this user is redirected to when they log in.
            </p>
            <Button variant="secondary" size="sm" onClick={handleSetDefaultSurgery}>
              Set as default surgery
            </Button>
          </div>
        )}
      </div>

      {/* Security & danger zone */}
      <div className="pt-5">
        <h4 className="text-md font-medium text-gray-900 mb-3">Security</h4>
        {showResetPassword ? (
          <form onSubmit={handleResetPassword} className="mb-4">
            <div className="flex flex-wrap items-end gap-3">
              <FormField label="New Password" htmlFor="member-new-password" className="mb-0 flex-1 min-w-[180px]">
                <Input
                  type="password"
                  id="member-new-password"
                  required
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </FormField>
              <Button
                type="submit"
                size="sm"
                variant="danger"
                loading={isResettingPassword}
                disabled={!newPassword}
              >
                Reset password
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isResettingPassword}
                onClick={() => {
                  setShowResetPassword(false)
                  setNewPassword('')
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => setShowResetPassword(true)}>
              Reset password
            </Button>
            <Button
              variant="danger-soft"
              size="sm"
              onClick={() =>
                onRequestConfirm({
                  type: 'remove-access',
                  userId: membership.user.id,
                  email: membership.user.email,
                })
              }
            >
              Remove access
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  )
}
