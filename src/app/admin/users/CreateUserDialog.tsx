'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Button, Dialog, FormField, Input, Select } from '@/components/ui'
import type { Surgery } from './types'

interface CreateUserDialogProps {
  open: boolean
  onClose: () => void
  surgeries: Surgery[]
}

const INITIAL_FORM = {
  email: '',
  name: '',
  password: '',
  globalRole: 'USER',
  isTestUser: false,
  symptomUsageLimit: 25,
  initialSurgeryId: '',
  initialSurgeryRole: 'STANDARD' as 'STANDARD' | 'ADMIN',
}

export default function CreateUserDialog({ open, onClose, surgeries }: CreateUserDialogProps) {
  const router = useRouter()
  const [newUser, setNewUser] = useState(INITIAL_FORM)

  const handleClose = () => {
    onClose()
    setNewUser(INITIAL_FORM)
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // First, create the user
      const { initialSurgeryId, initialSurgeryRole, ...userData } = newUser
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      if (response.ok) {
        const createdUser = await response.json()

        // If a surgery was selected, create the membership
        if (initialSurgeryId) {
          try {
            const membershipResponse = await fetch(`/api/admin/users/${createdUser.id}/memberships`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                surgeryId: initialSurgeryId,
                role: initialSurgeryRole,
              }),
            })

            if (!membershipResponse.ok) {
              const error = await membershipResponse.json()
              toast.error(`User created but failed to add surgery membership: ${error.error}`)
            }
          } catch (membershipError) {
            console.error('Error creating membership:', membershipError)
            toast.error('User created but failed to add surgery membership. You can add it manually later.')
          }
        }

        toast.success('User created')
        router.refresh()
      } else {
        const error = await response.json()
        toast.error(`Error creating user: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating user:', error)
      toast.error('Failed to create user. Please try again.')
    }

    handleClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Create New User"
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-user-form">
            Create User
          </Button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={handleCreateUser}>
        <FormField label="Email Address" htmlFor="email" required>
          <Input
            type="email"
            id="email"
            required
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            placeholder="user@example.com"
          />
        </FormField>
        <FormField label="Full Name" htmlFor="name">
          <Input
            id="name"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            placeholder="John Doe"
          />
        </FormField>
        <FormField label="Password" htmlFor="password" required>
          <Input
            type="password"
            id="password"
            required
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            placeholder="Enter password"
          />
        </FormField>
        <FormField label="Global Role" htmlFor="globalRole">
          <Select
            id="globalRole"
            value={newUser.globalRole}
            onChange={(e) => setNewUser({ ...newUser, globalRole: e.target.value })}
          >
            <option value="USER">User</option>
            <option value="SUPERUSER">System admin</option>
          </Select>
        </FormField>
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={newUser.isTestUser}
              onChange={(e) => setNewUser({ ...newUser, isTestUser: e.target.checked })}
              className="rounded border-gray-300 text-nhs-blue shadow-sm focus:ring-nhs-blue"
            />
            <span className="ml-2 text-sm text-gray-700">Test User (Limited Access)</span>
          </label>
        </div>
        {newUser.isTestUser && (
          <FormField label="Symptom Usage Limit" htmlFor="symptomUsageLimit">
            <Input
              type="number"
              id="symptomUsageLimit"
              min={1}
              value={newUser.symptomUsageLimit}
              onChange={(e) => setNewUser({ ...newUser, symptomUsageLimit: parseInt(e.target.value) || 25 })}
              placeholder="25"
            />
            <p className="mt-1 text-xs text-gray-500">
              Number of symptoms the test user can view before being locked out
            </p>
          </FormField>
        )}
        <FormField label="Initial Surgery Membership (Optional)" htmlFor="initialSurgery">
          <Select
            id="initialSurgery"
            value={newUser.initialSurgeryId}
            onChange={(e) => setNewUser({ ...newUser, initialSurgeryId: e.target.value })}
          >
            <option value="">None - Add later</option>
            {surgeries.map((surgery) => (
              <option key={surgery.id} value={surgery.id}>
                {surgery.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-gray-500">Optionally add this user to a surgery immediately</p>
        </FormField>
        {newUser.initialSurgeryId && (
          <FormField label="Role in Surgery" htmlFor="initialSurgeryRole" className="mb-6">
            <Select
              id="initialSurgeryRole"
              value={newUser.initialSurgeryRole}
              onChange={(e) =>
                setNewUser({ ...newUser, initialSurgeryRole: e.target.value as 'STANDARD' | 'ADMIN' })
              }
            >
              <option value="STANDARD">Standard</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </FormField>
        )}
      </form>
    </Dialog>
  )
}
