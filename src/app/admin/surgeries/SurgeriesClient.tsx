'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Surgery {
  id: string
  name: string
  slug: string | null
  createdAt: Date
  users: Array<{
    id: string
    role: string
    user: {
      id: string
      email: string
      name: string | null
    }
  }>
  _count: {
    users: number
  }
}

interface SurgeriesClientProps {
  surgeries: Surgery[]
}

export default function SurgeriesClient({ surgeries }: SurgeriesClientProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newSurgery, setNewSurgery] = useState({
    name: '',
    slug: ''
  })

  const handleCreateSurgery = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/admin/surgeries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSurgery),
      })

      if (response.ok) {
        // Success - refresh the page to show the new surgery
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Error creating surgery: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating surgery:', error)
      alert('Failed to create surgery. Please try again.')
    }
    
    setShowCreateModal(false)
    setNewSurgery({ name: '', slug: '' })
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
                Surgeries
              </h1>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Create Surgery
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              All Surgeries
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Manage surgery organisations and their settings.
            </p>
          </div>
          <ul className="divide-y divide-gray-200">
            {surgeries.map((surgery) => (
              <li key={surgery.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {surgery.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {surgery.slug && `Slug: ${surgery.slug}`}
                          {!surgery.slug && 'No slug set'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-500">
                        {surgery._count.users} user{surgery._count.users !== 1 ? 's' : ''}
                      </div>
                      <Link
                        href={`/s/${surgery.id}/admin/users`}
                        className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                      >
                        Manage Users
                      </Link>
                      <button className="text-blue-600 hover:text-blue-500 text-sm font-medium">
                        Edit
                      </button>
                    </div>
                  </div>
                  {surgery.users.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-500 mb-1">Users:</div>
                      <div className="flex flex-wrap gap-1">
                        {surgery.users.map((membership) => (
                          <span
                            key={membership.id}
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              membership.role === 'ADMIN'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {membership.user.name || membership.user.email} ({membership.role})
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

      {/* Create Surgery Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Create New Surgery
              </h3>
              <form onSubmit={handleCreateSurgery}>
                <div className="mb-4">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Surgery Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={newSurgery.name}
                    onChange={(e) => setNewSurgery({ ...newSurgery, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ide Lane Surgery"
                  />
                </div>
                <div className="mb-6">
                  <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
                    Slug (Optional)
                  </label>
                  <input
                    type="text"
                    id="slug"
                    value={newSurgery.slug}
                    onChange={(e) => setNewSurgery({ ...newSurgery, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="ide-lane"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Used for backward compatibility. Leave empty if not needed.
                  </p>
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
                    Create Surgery
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
