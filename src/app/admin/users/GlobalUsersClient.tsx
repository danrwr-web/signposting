'use client'

import { useState } from 'react'
import Link from 'next/link'
import AdminSearchBar from '@/components/admin/AdminSearchBar'
import AdminTable from '@/components/admin/AdminTable'
import NavigationPanelTrigger from '@/components/NavigationPanelTrigger'
import LogoSizeControl from '@/components/LogoSizeControl'
import { formatRelativeDate } from '@/lib/formatRelativeDate'

interface User {
  id: string
  email: string
  name: string | null
  globalRole: string
  defaultSurgeryId: string | null
  createdAt: Date
  isTestUser: boolean
  symptomUsageLimit: number | null
  symptomsUsed: number
  memberships: Array<{
    id: string
    role: string
    surgery: {
      id: string
      name: string
    }
  }>
  defaultSurgery: {
    id: string
    name: string
  } | null
}

interface Surgery {
  id: string
  name: string
}

interface GlobalUsersClientProps {
  users: User[]
  surgeries: Surgery[]
  lastActiveData: Record<string, string | null>
}

// Helper function to get user initials
function getUserInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.charAt(0).toUpperCase()
  }
  return email.charAt(0).toUpperCase()
}

export default function GlobalUsersClient({ users, surgeries, lastActiveData }: GlobalUsersClientProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showMembershipModal, setShowMembershipModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [resettingPasswordFor, setResettingPasswordFor] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    password: '',
    globalRole: 'USER',
    isTestUser: false,
    symptomUsageLimit: 25,
    initialSurgeryId: '',
    initialSurgeryRole: 'STANDARD' as 'STANDARD' | 'ADMIN'
  })
  const [newMembership, setNewMembership] = useState({
    surgeryId: '',
    role: 'STANDARD' as 'STANDARD' | 'ADMIN'
  })

  const handleEditUser = (user: User) => {
    setEditingUser(user)
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    
    try {
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingUser.name,
          globalRole: editingUser.globalRole,
          defaultSurgeryId: editingUser.defaultSurgeryId
        }),
      })

      if (response.ok) {
        // Refresh the page to show the updated user
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Error updating user: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating user:', error)
      alert('Failed to update user. Please try again.')
    }
    
    setEditingUser(null)
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
                role: initialSurgeryRole
              }),
            })

            if (!membershipResponse.ok) {
              const error = await membershipResponse.json()
              alert(`User created but failed to add surgery membership: ${error.error}`)
            }
          } catch (membershipError) {
            console.error('Error creating membership:', membershipError)
            alert('User created but failed to add surgery membership. You can add it manually later.')
          }
        }
        
        // Refresh the page to show the new user
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Error creating user: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating user:', error)
      alert('Failed to create user. Please try again.')
    }
    
    setShowCreateModal(false)
    setNewUser({ 
      email: '', 
      name: '', 
      password: '', 
      globalRole: 'USER', 
      isTestUser: false, 
      symptomUsageLimit: 25,
      initialSurgeryId: '',
      initialSurgeryRole: 'STANDARD'
    })
  }

  const handleResetTestUserUsage = async (userId: string) => {
    if (!confirm('Are you sure you want to reset this test user\'s usage count?')) {
      return
    }

    try {
      const response = await fetch('/api/admin/test-users/reset-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      if (response.ok) {
        alert('Test user usage reset successfully!')
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Error resetting usage: ${error.error}`)
      }
    } catch (error) {
      console.error('Error resetting usage:', error)
      alert('Failed to reset usage. Please try again.')
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    if (!resettingPasswordFor) return
    
    e.preventDefault()
    setIsResettingPassword(true)
    
    try {
      const response = await fetch(`/api/admin/users/${resettingPasswordFor.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword: newPassword,
        }),
      })

      if (response.ok) {
        alert('Password reset successfully')
        setResettingPasswordFor(null)
        setNewPassword('')
      } else {
        const error = await response.json()
        alert(`Failed to reset password: ${error.error}`)
      }
    } catch (error) {
      console.error('Error resetting password:', error)
      alert('Failed to reset password')
    } finally {
      setIsResettingPassword(false)
    }
  }

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete user "${userEmail}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        alert('User deleted successfully!')
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Error deleting user: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Failed to delete user. Please try again.')
    }
  }

  const handleManageMemberships = (user: User) => {
    setSelectedUser(user)
    setShowMembershipModal(true)
  }

  const handleAddMembership = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/memberships`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newMembership),
      })

      if (response.ok) {
        alert('Surgery membership added successfully!')
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Error adding membership: ${error.error}`)
      }
    } catch (error) {
      console.error('Error adding membership:', error)
      alert('Failed to add membership. Please try again.')
    }
  }

  const handleRemoveMembership = async (membershipId: string) => {
    if (!confirm('Are you sure you want to remove this surgery membership?')) {
      return
    }

    if (!selectedUser) return

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/memberships/${membershipId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        alert('Surgery membership removed successfully!')
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Error removing membership: ${error.error}`)
      }
    } catch (error) {
      console.error('Error removing membership:', error)
      alert('Failed to remove membership. Please try again.')
    }
  }

  const handleUpdateMembershipRole = async (membershipId: string, newRole: 'STANDARD' | 'ADMIN') => {
    if (!selectedUser) return

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}/memberships/${membershipId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      })

      if (response.ok) {
        alert('Membership role updated successfully!')
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Error updating membership role: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating membership role:', error)
      alert('Failed to update membership role. Please try again.')
    }
  }

  // Sort users alphabetically by name (fallback to email)
  const sortedUsers = [...users].sort((a, b) => {
    const nameA = (a.name || a.email).toLowerCase()
    const nameB = (b.name || b.email).toLowerCase()
    return nameA.localeCompare(nameB)
  })

  // Filter users by search query (name or email, case-insensitive)
  const filteredUsers = sortedUsers.filter((user) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    const nameMatch = user.name?.toLowerCase().includes(query) ?? false
    const emailMatch = user.email.toLowerCase().includes(query)
    return nameMatch || emailMatch
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - consistent with SimpleHeader */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Navigation Trigger + Logo */}
            <div className="flex items-center">
              <NavigationPanelTrigger className="mr-3" />
              <Link href="/s" className="flex items-center">
                <img
                  src="/images/signposting_logo_head.png"
                  alt="Signposting"
                  style={{ height: 'var(--logo-height, 58px)' }}
                  className="w-auto"
                />
              </Link>
              <LogoSizeControl />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Global Users
          </h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Create User
          </button>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              All Users
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Manage user accounts and their global roles across the system.
            </p>
          </div>

          {/* Search Box */}
          <AdminSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search users…"
            debounceMs={0}
          />

          {/* Table */}
          <AdminTable
            colWidths={["220px", "230px", "280px", "120px", "180px"]}
            cellPadding="px-4"
            columns={[
              {
                header: 'Name',
                key: 'name',
                render: (user) => (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {user.name || 'No name set'}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        user.globalRole === 'SUPERUSER'
                          ? 'bg-purple-50 text-purple-700 border border-purple-100'
                          : 'bg-gray-50 text-gray-700 border border-gray-100'
                      }`}
                    >
                      {user.globalRole === 'SUPERUSER' ? 'SUPERUSER' : 'USER'}
                    </span>
                  </div>
                ),
              },
              {
                header: 'Email',
                key: 'email',
                render: (user) => (
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-gray-500" title={user.email}>
                    {user.email}
                  </span>
                ),
              },
              {
                header: 'Surgery Memberships',
                key: 'memberships',
                className: 'align-top whitespace-normal',
                render: (user) => (
                  <div className="flex flex-col gap-0.5 text-sm text-gray-900">
                    {user.memberships.length === 0 ? (
                      <span className="text-gray-400 italic">No memberships</span>
                    ) : (
                      user.memberships.map((membership) => (
                        <span key={membership.id}>
                          {membership.surgery.name} ({membership.role})
                        </span>
                      ))
                    )}
                  </div>
                ),
              },
              {
                header: 'Last active',
                key: 'lastActive',
                render: (user) => {
                  const lastActiveIso = lastActiveData[user.id]
                  const lastActiveDate = lastActiveIso ? new Date(lastActiveIso) : null
                  return (
                    <span className="text-sm text-gray-500">
                      {formatRelativeDate(lastActiveDate)}
                    </span>
                  )
                },
              },
              {
                header: 'Actions',
                key: 'actions',
                className: 'text-right whitespace-nowrap',
                sticky: true,
                render: (user) => (
                  <div className="flex gap-2 justify-end">
                    <button
                      className="text-blue-600 hover:text-blue-900"
                      onClick={() => handleEditUser(user)}
                    >
                      Edit
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      className="text-orange-600 hover:text-orange-900"
                      onClick={() => setResettingPasswordFor(user)}
                    >
                      Reset
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      className="text-blue-600 hover:text-blue-900"
                      onClick={() => handleManageMemberships(user)}
                    >
                      Memberships
                    </button>
                    {user.isTestUser && (
                      <>
                        <span className="text-gray-300">|</span>
                        <button
                          className="text-gray-600 hover:text-gray-900"
                          onClick={() => handleResetTestUserUsage(user.id)}
                        >
                          Reset Usage
                        </button>
                      </>
                    )}
                    <span className="text-gray-300">|</span>
                    <button
                      className="text-red-600 hover:text-red-900"
                      onClick={() => handleDeleteUser(user.id, user.email)}
                    >
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
            rows={filteredUsers}
            emptyMessage={searchQuery.trim() ? 'No users match your search.' : 'No users found.'}
            rowKey={(user) => user.id}
          />
        </div>
      </main>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Create New User
              </h3>
              <form onSubmit={handleCreateUser}>
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="user@example.com"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="John Doe"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter password"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="globalRole" className="block text-sm font-medium text-gray-700 mb-1">
                    Global Role
                  </label>
                  <select
                    id="globalRole"
                    value={newUser.globalRole}
                    onChange={(e) => setNewUser({ ...newUser, globalRole: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="USER">User</option>
                    <option value="SUPERUSER">System admin</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newUser.isTestUser}
                      onChange={(e) => setNewUser({ ...newUser, isTestUser: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Test User (Limited Access)</span>
                  </label>
                </div>
                {newUser.isTestUser && (
                  <div className="mb-4">
                    <label htmlFor="symptomUsageLimit" className="block text-sm font-medium text-gray-700 mb-1">
                      Symptom Usage Limit
                    </label>
                    <input
                      type="number"
                      id="symptomUsageLimit"
                      min="1"
                      value={newUser.symptomUsageLimit}
                      onChange={(e) => setNewUser({ ...newUser, symptomUsageLimit: parseInt(e.target.value) || 25 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="25"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Number of symptoms the test user can view before being locked out
                    </p>
                  </div>
                )}
                <div className="mb-4">
                  <label htmlFor="initialSurgery" className="block text-sm font-medium text-gray-700 mb-1">
                    Initial Surgery Membership (Optional)
                  </label>
                  <select
                    id="initialSurgery"
                    value={newUser.initialSurgeryId}
                    onChange={(e) => setNewUser({ ...newUser, initialSurgeryId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">None - Add later</option>
                    {surgeries.map((surgery) => (
                      <option key={surgery.id} value={surgery.id}>
                        {surgery.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Optionally add this user to a surgery immediately
                  </p>
                </div>
                {newUser.initialSurgeryId && (
                  <div className="mb-6">
                    <label htmlFor="initialSurgeryRole" className="block text-sm font-medium text-gray-700 mb-1">
                      Role in Surgery
                    </label>
                    <select
                      id="initialSurgeryRole"
                      value={newUser.initialSurgeryRole}
                      onChange={(e) => setNewUser({ ...newUser, initialSurgeryRole: e.target.value as 'STANDARD' | 'ADMIN' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="STANDARD">Standard</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                )}
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      setNewUser({ 
                        email: '', 
                        name: '', 
                        password: '', 
                        globalRole: 'USER', 
                        isTestUser: false, 
                        symptomUsageLimit: 25,
                        initialSurgeryId: '',
                        initialSurgeryRole: 'STANDARD'
                      })
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Edit User
              </h3>
              <form onSubmit={handleUpdateUser}>
                <div className="mb-4">
                  <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="edit-email"
                    value={editingUser.email}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Email cannot be changed
                  </p>
                </div>
                <div className="mb-4">
                  <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="edit-name"
                    value={editingUser.name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="John Doe"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="edit-globalRole" className="block text-sm font-medium text-gray-700 mb-1">
                    Global Role
                  </label>
                  <select
                    id="edit-globalRole"
                    value={editingUser.globalRole}
                    onChange={(e) => setEditingUser({ ...editingUser, globalRole: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="USER">Standard User</option>
                    <option value="SUPERUSER">System admin</option>
                  </select>
                </div>
                <div className="mb-6">
                  <label htmlFor="edit-defaultSurgery" className="block text-sm font-medium text-gray-700 mb-1">
                    Default Surgery
                  </label>
                  <select
                    id="edit-defaultSurgery"
                    value={editingUser.defaultSurgeryId || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, defaultSurgeryId: e.target.value || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">No default surgery</option>
                    {surgeries.map((surgery) => (
                      <option key={surgery.id} value={surgery.id}>
                        {surgery.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    The surgery this user will be redirected to when they log in
                  </p>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Update User
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Membership Management Modal */}
      {showMembershipModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Manage Surgery Memberships - {selectedUser.name || selectedUser.email}
                </h3>
                <button
                  onClick={() => {
                    setShowMembershipModal(false)
                    setSelectedUser(null)
                    setNewMembership({ surgeryId: '', role: 'STANDARD' })
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Current Memberships */}
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">Current Memberships</h4>
                {selectedUser.memberships.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No surgery memberships</p>
                ) : (
                  <div className="space-y-2">
                    {selectedUser.memberships.map((membership) => (
                      <div key={membership.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <div>
                          <span className="font-medium">{membership.surgery.name}</span>
                          <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                            membership.role === 'ADMIN' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {membership.role}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <select
                            value={membership.role}
                            onChange={(e) => handleUpdateMembershipRole(membership.id, e.target.value as 'STANDARD' | 'ADMIN')}
                            className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="STANDARD">Standard</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                          <button
                            onClick={() => handleRemoveMembership(membership.id)}
                            className="text-xs text-red-600 hover:text-red-500 px-2 py-1"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Membership */}
              <div className="border-t pt-4">
                <h4 className="text-md font-medium text-gray-900 mb-3">Add New Membership</h4>
                <form onSubmit={handleAddMembership}>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="surgeryId" className="block text-sm font-medium text-gray-700 mb-1">
                        Surgery
                      </label>
                      <select
                        id="surgeryId"
                        required
                        value={newMembership.surgeryId}
                        onChange={(e) => setNewMembership({ ...newMembership, surgeryId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select surgery...</option>
                        {surgeries
                          .filter(surgery => !selectedUser.memberships.some(m => m.surgery.id === surgery.id))
                          .map((surgery) => (
                            <option key={surgery.id} value={surgery.id}>
                              {surgery.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                        Role
                      </label>
                      <select
                        id="role"
                        value={newMembership.role}
                        onChange={(e) => setNewMembership({ ...newMembership, role: e.target.value as 'STANDARD' | 'ADMIN' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="STANDARD">Standard</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMembershipModal(false)
                        setSelectedUser(null)
                        setNewMembership({ surgeryId: '', role: 'STANDARD' })
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                    >
                      Add Membership
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingPasswordFor && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Reset Password
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Reset password for {resettingPasswordFor.email}
              </p>
              <form onSubmit={handleResetPassword}>
                <div className="mb-6">
                  <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    id="new-password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter new password"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setResettingPasswordFor(null)
                      setNewPassword('')
                    }}
                    disabled={isResettingPassword}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isResettingPassword || !newPassword}
                    className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {isResettingPassword ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
