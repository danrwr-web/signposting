'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Button, Dialog, FormField, Input, Select } from '@/components/ui'

interface AddUserDialogProps {
  open: boolean
  onClose: () => void
  surgeryId: string
}

const INITIAL_FORM = {
  email: '',
  name: '',
  password: '',
  role: 'STANDARD',
}

export default function AddUserDialog({ open, onClose, surgeryId }: AddUserDialogProps) {
  const router = useRouter()
  const [newUser, setNewUser] = useState(INITIAL_FORM)

  const handleClose = () => {
    onClose()
    setNewUser(INITIAL_FORM)
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`/api/s/${surgeryId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      })

      if (response.ok) {
        toast.success('User added successfully')
        router.refresh()
      } else {
        const error = await response.json()
        toast.error(`Failed to add user: ${error.error}`)
      }
    } catch (error) {
      console.error('Error adding user:', error)
      toast.error('Failed to add user')
    }

    handleClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add User to Surgery"
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-user-form">
            Add User
          </Button>
        </>
      }
    >
      <form id="add-user-form" onSubmit={handleAddUser}>
        <FormField label="Email Address" htmlFor="email" required>
          <Input
            type="email"
            id="email"
            required
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            placeholder="user@example.com"
          />
          <p className="mt-1 text-xs text-gray-500">
            If the user doesn&rsquo;t exist, a new account will be created.
          </p>
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
        <FormField label="Role" htmlFor="role" className="mb-2">
          <Select
            id="role"
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
          >
            <option value="STANDARD">Standard User</option>
            <option value="ADMIN">Practice admin</option>
          </Select>
        </FormField>
      </form>
    </Dialog>
  )
}
