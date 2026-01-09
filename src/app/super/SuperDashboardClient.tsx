/**
 * Super dashboard client component
 * Handles surgery management interface for superuser
 */

'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { Surgery } from '@/lib/api-contracts'

interface SuperDashboardClientProps {
  surgeries: Surgery[]
}

export default function SuperDashboardClient({ surgeries }: SuperDashboardClientProps) {
  const [surgeriesList, setSurgeriesList] = useState(surgeries)
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingSurgery, setEditingSurgery] = useState<Surgery | null>(null)

  const handleCreateSurgery = async (formData: FormData) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/surgeries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          adminEmail: formData.get('adminEmail'),
          adminPassword: formData.get('adminPassword'),
        }),
      })

      const result = await response.json()
      
      if (response.ok) {
        toast.success('Surgery created successfully!')
        setSurgeriesList(prev => [...prev, result.surgery])
        setShowCreateForm(false)
      } else {
        toast.error(result.message || 'Failed to create surgery')
      }
    } catch (error) {
      console.error('Create surgery error:', error)
      toast.error('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateSurgery = async (formData: FormData) => {
    if (!editingSurgery) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/surgeries/${editingSurgery.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          adminEmail: formData.get('adminEmail'),
          adminPassword: formData.get('adminPassword'),
        }),
      })

      const result = await response.json()
      
      if (response.ok) {
        toast.success('Surgery updated successfully!')
        setSurgeriesList(prev => 
          prev.map(s => s.id === editingSurgery.id ? result.surgery : s)
        )
        setEditingSurgery(null)
      } else {
        toast.error(result.message || 'Failed to update surgery')
      }
    } catch (error) {
      console.error('Update surgery error:', error)
      toast.error('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteSurgery = async (surgeryId: string) => {
    if (!confirm('Are you sure you want to delete this surgery? This action cannot be undone.')) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/surgeries/${surgeryId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Surgery deleted successfully!')
        setSurgeriesList(prev => prev.filter(s => s.id !== surgeryId))
      } else {
        const result = await response.json()
        toast.error(result.message || 'Failed to delete surgery')
      }
    } catch (error) {
      console.error('Delete surgery error:', error)
      toast.error('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Super Dashboard</h1>
          <p className="mt-2 text-gray-600">Manage surgeries and admin accounts</p>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Surgeries</h2>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-nhs-blue text-white rounded-lg hover:bg-nhs-dark-blue transition-colors"
              >
                Add Surgery
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admin Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {surgeriesList.map((surgery) => (
                  <tr key={surgery.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {surgery.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {surgery.adminEmail || 'Not set'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(surgery.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setEditingSurgery(surgery)}
                        className="text-nhs-blue hover:text-nhs-dark-blue mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteSurgery(surgery.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Surgery Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Create Surgery</h3>
                <form action={handleCreateSurgery}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name
                    </label>
                    <input
                      name="name"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-nhs-blue focus:border-nhs-blue"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Admin Email
                    </label>
                    <input
                      name="adminEmail"
                      type="email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-nhs-blue focus:border-nhs-blue"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Admin Password
                    </label>
                    <input
                      name="adminPassword"
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-nhs-blue focus:border-nhs-blue"
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 bg-nhs-blue text-white rounded-lg hover:bg-nhs-dark-blue disabled:opacity-50"
                    >
                      {isLoading ? 'Creating...' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Edit Surgery Modal */}
        {editingSurgery && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Surgery</h3>
                <form action={handleUpdateSurgery}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name
                    </label>
                    <input
                      name="name"
                      defaultValue={editingSurgery.name}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-nhs-blue focus:border-nhs-blue"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Admin Email
                    </label>
                    <input
                      name="adminEmail"
                      type="email"
                      defaultValue={editingSurgery.adminEmail || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-nhs-blue focus:border-nhs-blue"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Admin Password (leave blank to keep current)
                    </label>
                    <input
                      name="adminPassword"
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-nhs-blue focus:border-nhs-blue"
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setEditingSurgery(null)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 bg-nhs-blue text-white rounded-lg hover:bg-nhs-dark-blue disabled:opacity-50"
                    >
                      {isLoading ? 'Updating...' : 'Update'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
