'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { formatRelativeDate } from '@/lib/formatRelativeDate'
import { Badge, Button, Dialog, FormField, Input, Select } from '@/components/ui'
import { getUserInitials } from './userTableUtils'
import type { PendingAction, Surgery, User } from './types'

interface UserDetailPanelProps {
  user: User | null
  surgeries: Surgery[]
  lastActive: string | null
  onClose: () => void
  /** Routes destructive actions to the parent's ConfirmDialog */
  onRequestConfirm: (action: PendingAction) => void
}

export default function UserDetailPanel({
  user,
  surgeries,
  lastActive,
  onClose,
  onRequestConfirm,
}: UserDetailPanelProps) {
  const router = useRouter()
  const [details, setDetails] = useState({
    name: '',
    globalRole: 'USER',
    defaultSurgeryId: '' as string,
  })
  const [savingDetails, setSavingDetails] = useState(false)
  const [newMembership, setNewMembership] = useState({
    surgeryId: '',
    role: 'STANDARD' as 'STANDARD' | 'ADMIN',
  })
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [isResettingPassword, setIsResettingPassword] = useState(false)

  const userId = user?.id ?? null

  // Re-seed the form when a different user opens. Deliberately not on every
  // `user` change — router.refresh() after a membership edit delivers a fresh
  // object and must not clobber in-progress detail edits.
  useEffect(() => {
    if (!userId || !user) return
    setDetails({
      name: user.name || '',
      globalRole: user.globalRole,
      defaultSurgeryId: user.defaultSurgeryId || '',
    })
    setNewMembership({ surgeryId: '', role: 'STANDARD' })
    setShowResetPassword(false)
    setNewPassword('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  if (!user) return null

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingDetails(true)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: details.name,
          globalRole: details.globalRole,
          defaultSurgeryId: details.defaultSurgeryId || null,
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

  const handleAddMembership = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch(`/api/admin/users/${user.id}/memberships`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newMembership),
      })

      if (response.ok) {
        toast.success('Surgery membership added')
        setNewMembership({ surgeryId: '', role: 'STANDARD' })
        router.refresh()
      } else {
        const error = await response.json()
        toast.error(`Error adding membership: ${error.error}`)
      }
    } catch (error) {
      console.error('Error adding membership:', error)
      toast.error('Failed to add membership. Please try again.')
    }
  }

  const handleUpdateMembershipRole = async (membershipId: string, newRole: 'STANDARD' | 'ADMIN') => {
    try {
      const response = await fetch(`/api/admin/users/${user.id}/memberships/${membershipId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      })

      if (response.ok) {
        toast.success('Membership role updated')
        router.refresh()
      } else {
        const error = await response.json()
        toast.error(`Error updating membership role: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating membership role:', error)
      toast.error('Failed to update membership role. Please try again.')
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsResettingPassword(true)

    try {
      const response = await fetch(`/api/admin/users/${user.id}/reset-password`, {
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

  const availableSurgeries = surgeries.filter(
    (surgery) => !user.memberships.some((m) => m.surgery.id === surgery.id)
  )
  const lastActiveDate = lastActive ? new Date(lastActive) : null

  return (
    <Dialog
      open
      onClose={onClose}
      title={user.name || user.email}
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
          {getUserInitials(user.name, user.email)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-semibold text-gray-900 truncate">
              {user.name || 'No name set'}
            </span>
            {user.globalRole === 'SUPERUSER' && (
              <Badge color="purple" size="sm" pill={false}>
                System admin
              </Badge>
            )}
            {user.isTestUser && (
              <Badge color="amber" size="sm" pill={false}>
                Test
              </Badge>
            )}
          </div>
          <div className="text-sm text-gray-500 truncate">{user.email}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Created{' '}
            {new Date(user.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            {' · '}
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
          <FormField label="Email Address" htmlFor="detail-email">
            <Input
              type="email"
              id="detail-email"
              value={user.email}
              disabled
              className="bg-gray-100 text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
          </FormField>
          <FormField label="Full Name" htmlFor="detail-name">
            <Input
              id="detail-name"
              value={details.name}
              onChange={(e) => setDetails({ ...details, name: e.target.value })}
              placeholder="John Doe"
            />
          </FormField>
          <FormField label="Global Role" htmlFor="detail-globalRole">
            <Select
              id="detail-globalRole"
              value={details.globalRole}
              onChange={(e) => setDetails({ ...details, globalRole: e.target.value })}
            >
              <option value="USER">Standard User</option>
              <option value="SUPERUSER">System admin</option>
            </Select>
          </FormField>
          <FormField label="Default Surgery" htmlFor="detail-defaultSurgery">
            <Select
              id="detail-defaultSurgery"
              value={details.defaultSurgeryId}
              onChange={(e) => setDetails({ ...details, defaultSurgeryId: e.target.value })}
            >
              <option value="">No default surgery</option>
              {surgeries.map((surgery) => (
                <option key={surgery.id} value={surgery.id}>
                  {surgery.name}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-gray-500">
              The surgery this user will be redirected to when they log in
            </p>
          </FormField>
        </div>
        <Button type="submit" size="sm" loading={savingDetails}>
          Save changes
        </Button>
      </form>

      {/* Surgery memberships */}
      <div className="pt-5 pb-6 border-b border-gray-200">
        <h4 className="text-md font-medium text-gray-900 mb-3">Surgery memberships</h4>
        {user.memberships.length === 0 ? (
          <p className="text-sm text-gray-500 italic mb-4">No surgery memberships</p>
        ) : (
          <div className="space-y-2 mb-4">
            {user.memberships.map((membership) => (
              <div
                key={membership.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                <span className="font-medium text-sm">{membership.surgery.name}</span>
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`membership-role-${membership.id}`}>
                    Role at {membership.surgery.name}
                  </label>
                  <Select
                    id={`membership-role-${membership.id}`}
                    value={membership.role}
                    onChange={(e) =>
                      handleUpdateMembershipRole(membership.id, e.target.value as 'STANDARD' | 'ADMIN')
                    }
                    className="!w-auto text-xs py-1"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="ADMIN">Admin</option>
                  </Select>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() =>
                      onRequestConfirm({
                        type: 'remove-membership',
                        userId: user.id,
                        membershipId: membership.id,
                      })
                    }
                    className="text-red-600 hover:text-red-500"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {availableSurgeries.length > 0 && (
          <form onSubmit={handleAddMembership}>
            <div className="flex flex-wrap items-end gap-3">
              <FormField label="Add to surgery" htmlFor="add-surgeryId" className="mb-0 flex-1 min-w-[180px]">
                <Select
                  id="add-surgeryId"
                  required
                  value={newMembership.surgeryId}
                  onChange={(e) => setNewMembership({ ...newMembership, surgeryId: e.target.value })}
                >
                  <option value="">Select surgery...</option>
                  {availableSurgeries.map((surgery) => (
                    <option key={surgery.id} value={surgery.id}>
                      {surgery.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Role" htmlFor="add-role" className="mb-0">
                <Select
                  id="add-role"
                  value={newMembership.role}
                  onChange={(e) =>
                    setNewMembership({ ...newMembership, role: e.target.value as 'STANDARD' | 'ADMIN' })
                  }
                >
                  <option value="STANDARD">Standard</option>
                  <option value="ADMIN">Admin</option>
                </Select>
              </FormField>
              <Button type="submit" size="sm" variant="secondary" className="mb-0">
                Add membership
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Test user usage */}
      {user.isTestUser && (
        <div className="pt-5 pb-6 border-b border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-2">Test user usage</h4>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Symptoms used:{' '}
              <span className="font-medium">
                {user.symptomsUsed} / {user.symptomUsageLimit ?? '∞'}
              </span>
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onRequestConfirm({ type: 'reset-usage', userId: user.id })}
            >
              Reset usage count
            </Button>
          </div>
        </div>
      )}

      {/* Security & danger zone */}
      <div className="pt-5">
        <h4 className="text-md font-medium text-gray-900 mb-3">Security</h4>
        {showResetPassword ? (
          <form onSubmit={handleResetPassword} className="mb-4">
            <div className="flex flex-wrap items-end gap-3">
              <FormField label="New Password" htmlFor="detail-new-password" className="mb-0 flex-1 min-w-[180px]">
                <Input
                  type="password"
                  id="detail-new-password"
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
                onRequestConfirm({ type: 'delete-user', userId: user.id, email: user.email })
              }
            >
              Delete user
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  )
}
