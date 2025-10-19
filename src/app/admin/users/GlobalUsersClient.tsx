'use client'

import { useState } from 'react'
import Link from 'next/link'

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

interface GlobalUsersClientProps {
  users: User[]
}

export default function GlobalUsersClient({ users }: GlobalUsersClientProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    password: '',
    globalRole: 'USER',
    isTestUser: false,
    symptomUsageLimit: 25
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
          globalRole: editingUser.globalRole
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
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      })

      if (response.ok) {
        // Success - refresh the page to show the new user
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
    setNewUser({ email: '', name: '', password: '', globalRole: 'USER', isTestUser: false, symptomUsageLimit: 25 })
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
                ← Back to Admin
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                Global Users
              </h1>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Create User
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              All Users
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Manage user accounts and their global roles across the system.
            </p>
          </div>
          <ul className="divide-y divide-gray-200">
            {users.map((user) => (
              <li key={user.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name || 'No name set'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-500">
                        <div className="flex items-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.globalRole === 'SUPERUSER' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.globalRole}
                          </span>
                          {user.isTestUser && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              TEST USER
                            </span>
                          )}
                        </div>
                        {user.defaultSurgery && (
                          <div className="mt-1 text-xs text-gray-400">
                            Default: {user.defaultSurgery.name}
                          </div>
                        )}
                        {user.isTestUser && user.symptomUsageLimit && (
                          <div className="mt-1 text-xs text-gray-400">
                            Usage: {user.symptomsUsed}/{user.symptomUsageLimit} symptoms
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {user.memberships.length} surgery{user.memberships.length !== 1 ? 'ies' : ''}
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleEditUser(user)}
                          className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                        >
                          Edit
                        </button>
                        {user.isTestUser && (
                          <button 
                            onClick={() => handleResetTestUserUsage(user.id)}
                            className="text-green-600 hover:text-green-500 text-sm font-medium"
                          >
                            Reset Usage
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {user.memberships.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-500 mb-1">Surgery Memberships:</div>
                      <div className="flex flex-wrap gap-1">
                        {user.memberships.map((membership) => (
                          <span
                            key={membership.id}
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              membership.role === 'ADMIN'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {membership.surgery.name} ({membership.role})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
                    <option value="SUPERUSER">Superuser</option>
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
                  <div className="mb-6">
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
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
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
                <div className="mb-6">
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
                    <option value="SUPERUSER">Superuser</option>
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
