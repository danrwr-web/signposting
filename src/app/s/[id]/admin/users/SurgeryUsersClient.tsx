'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SessionUser } from '@/lib/rbac'

interface Surgery {
  id: string
  name: string
  slug: string | null
  users: Array<{
    id: string
    role: string
    user: {
      id: string
      email: string
      name: string | null
      defaultSurgeryId: string | null
    }
  }>
}

interface SurgeryUsersClientProps {
  surgery: Surgery
  user: SessionUser
}

export default function SurgeryUsersClient({ surgery, user }: SurgeryUsersClientProps) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState<{ id: string; email: string; name: string | null; role: string } | null>(null)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState('STANDARD')

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`/api/s/${surgery.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUserEmail,
          name: newUserName,
          password: newUserPassword,
          role: newUserRole,
        }),
      })

      if (response.ok) {
        // Refresh the page to show the new user
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to add user: ${error.error}`)
      }
    } catch (error) {
      console.error('Error adding user:', error)
      alert('Failed to add user')
    }
    
    setShowAddModal(false)
    setNewUserEmail('')
    setNewUserName('')
    setNewUserPassword('')
    setNewUserRole('STANDARD')
  }

  const handleRemoveUser = async (userId: string) => {
    if (confirm('Are you sure you want to remove this user from the surgery?')) {
      try {
        const response = await fetch(`/api/s/${surgery.id}/members/${userId}`, {
          method: 'DELETE',
        })

        if (response.ok) {
          // Refresh the page to show the updated user list
          window.location.reload()
        } else {
          const error = await response.json()
          alert(`Failed to remove user: ${error.error}`)
        }
      } catch (error) {
        console.error('Error removing user:', error)
        alert('Failed to remove user')
      }
    }
  }

  const handleEditUser = (membership: { id: string; role: string; user: { id: string; email: string; name: string | null } }) => {
    setEditingUser({
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role
    })
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    
    try {
      const response = await fetch(`/api/s/${surgery.id}/members/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingUser.name,
          role: editingUser.role
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

  const handleSetDefaultSurgery = async (userId: string) => {
    try {
      const response = await fetch(`/api/s/${surgery.id}/members/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setAsDefault: true,
        }),
      })

      if (response.ok) {
        // Refresh the page to show the updated user list
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to set default surgery: ${error.error}`)
      }
    } catch (error) {
      console.error('Error setting default surgery:', error)
      alert('Failed to set default surgery')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link
                href="/admin"
                className="text-blue-600 hover:text-blue-500 mr-4"
              >
                ← Back to Admin Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                {surgery.name} - User Management
              </h1>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Add User
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Surgery Members
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Manage user access and roles within {surgery.name}.
            </p>
          </div>
          <ul className="divide-y divide-gray-200">
            {surgery.users.map((membership) => (
              <li key={membership.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {membership.user.name ? membership.user.name.charAt(0).toUpperCase() : membership.user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {membership.user.name || 'No name set'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {membership.user.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-500">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          membership.role === 'ADMIN' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {membership.role}
                        </span>
                        {membership.user.defaultSurgeryId === surgery.id && (
                          <div className="mt-1 text-xs text-gray-400">
                            Default surgery
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleEditUser(membership)}
                          className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                        >
                          Edit
                        </button>
                        {membership.user.defaultSurgeryId !== surgery.id && (
                          <button
                            onClick={() => handleSetDefaultSurgery(membership.user.id)}
                            className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                          >
                            Set as Default
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveUser(membership.user.id)}
                          className="text-red-600 hover:text-red-500 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Add User to Surgery
              </h3>
              <form onSubmit={handleAddUser}>
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="user@example.com"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    If the user doesn't exist, a new account will be created.
                  </p>
                </div>
                <div className="mb-4">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
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
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter password"
                  />
                </div>
                <div className="mb-6">
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    id="role"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="STANDARD">Standard User</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Add User
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
                <div className="mb-6">
                  <label htmlFor="edit-role" className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    id="edit-role"
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="STANDARD">Standard User</option>
                    <option value="ADMIN">Admin</option>
                  </select>
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
    </div>
  )
}
