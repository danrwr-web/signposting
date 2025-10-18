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
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    password: '',
    globalRole: 'USER'
  })

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement user creation API call
    console.log('Creating user:', newUser)
    setShowCreateModal(false)
    setNewUser({ email: '', name: '', password: '', globalRole: 'USER' })
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
                        </div>
                        {user.defaultSurgery && (
                          <div className="mt-1 text-xs text-gray-400">
                            Default: {user.defaultSurgery.name}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {user.memberships.length} surgery{user.memberships.length !== 1 ? 'ies' : ''}
                      </div>
                      <button className="text-blue-600 hover:text-blue-500 text-sm font-medium">
                        Edit
                      </button>
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
                <div className="mb-6">
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
    </div>
  )
}
