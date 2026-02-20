'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import AdminSearchBar from '@/components/admin/AdminSearchBar'
import AdminTable from '@/components/admin/AdminTable'
import NavigationPanelTrigger from '@/components/NavigationPanelTrigger'
import LogoSizeControl from '@/components/LogoSizeControl'
import { Button, Dialog, Input, Badge } from '@/components/ui'

interface Surgery {
  id: string
  name: string
  slug: string | null
  adminEmail: string | null
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

interface BaselineDates {
  signpostingBaseline: string | null
  practiceHandbookBaseline: string | null
}

interface SurgeriesClientProps {
  surgeries: Surgery[]
}

export default function SurgeriesClient({ surgeries }: SurgeriesClientProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingSurgery, setEditingSurgery] = useState<Surgery | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Baseline dates state
  const [baselineDates, setBaselineDates] = useState<BaselineDates>({
    signpostingBaseline: null,
    practiceHandbookBaseline: null,
  })
  const [isLoadingBaselines, setIsLoadingBaselines] = useState(false)
  const [isSavingBaselines, setIsSavingBaselines] = useState(false)

  // Fetch baseline dates when editing a surgery
  const fetchBaselineDates = useCallback(async (surgeryId: string) => {
    setIsLoadingBaselines(true)
    try {
      const res = await fetch(`/api/admin/surgeries/${surgeryId}/baselines`)
      if (res.ok) {
        const data = await res.json()
        setBaselineDates({
          signpostingBaseline: data.signpostingBaseline ? data.signpostingBaseline.split('T')[0] : null,
          practiceHandbookBaseline: data.practiceHandbookBaseline ? data.practiceHandbookBaseline.split('T')[0] : null,
        })
      }
    } catch (error) {
      console.error('Error fetching baseline dates:', error)
    } finally {
      setIsLoadingBaselines(false)
    }
  }, [])

  // Fetch baselines when editingSurgery changes
  useEffect(() => {
    if (editingSurgery) {
      fetchBaselineDates(editingSurgery.id)
    } else {
      setBaselineDates({ signpostingBaseline: null, practiceHandbookBaseline: null })
    }
  }, [editingSurgery, fetchBaselineDates])

  // Show toast helper
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Save baseline dates
  const handleSaveBaselines = async () => {
    if (!editingSurgery) return

    setIsSavingBaselines(true)
    try {
      const res = await fetch(`/api/admin/surgeries/${editingSurgery.id}/baselines`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signpostingBaseline: baselineDates.signpostingBaseline || null,
          practiceHandbookBaseline: baselineDates.practiceHandbookBaseline || null,
        }),
      })

      if (res.ok) {
        showToast('Baseline dates saved successfully', 'success')
      } else {
        const error = await res.json()
        showToast(`Error: ${error.error || 'Failed to save'}`, 'error')
      }
    } catch (error) {
      console.error('Error saving baseline dates:', error)
      showToast('Failed to save baseline dates', 'error')
    } finally {
      setIsSavingBaselines(false)
    }
  }

  // Set baseline to today helper
  const setBaselineToToday = (field: 'signpostingBaseline' | 'practiceHandbookBaseline') => {
    const today = new Date().toISOString().split('T')[0]
    setBaselineDates(prev => ({ ...prev, [field]: today }))
  }

  // Sort surgeries alphabetically by name
  const sortedSurgeries = [...surgeries].sort((a, b) => {
    const nameA = (a.name || '').toLowerCase()
    const nameB = (b.name || '').toLowerCase()
    return nameA.localeCompare(nameB)
  })

  const [surgeriesList, setSurgeriesList] = useState(sortedSurgeries)

  // Filter surgeries by search query (name, case-insensitive)
  const filteredSurgeries = sortedSurgeries.filter((surgery) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    const nameMatch = surgery.name?.toLowerCase().includes(query) ?? false
    return nameMatch
  })
  const [newSurgery, setNewSurgery] = useState({
    name: ''
  })

  const handleCreateSurgery = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/surgeries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newSurgery.name }),
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
    } finally {
      setIsLoading(false)
      setShowCreateModal(false)
      setNewSurgery({ name: '' })
    }
  }

  const handleUpdateSurgery = async (e: React.FormEvent<HTMLFormElement>) => {
    if (!editingSurgery) return

    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      const response = await fetch(`/api/admin/surgeries/${editingSurgery.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.get('name'),
          adminEmail: formData.get('adminEmail') || undefined,
          adminPassword: formData.get('adminPassword') || undefined,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        // Update the local state
        setSurgeriesList(prev =>
          prev.map(s => s.id === editingSurgery.id ? { ...s, name: result.surgery.name, adminEmail: result.surgery.adminEmail } : s)
        )
        setEditingSurgery(null)
        alert('Surgery updated successfully!')
      } else {
        alert(`Error updating surgery: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error updating surgery:', error)
      alert('Failed to update surgery. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

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
            Surgeries
          </h1>
          <Button onClick={() => setShowCreateModal(true)}>
            Create Surgery
          </Button>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              All Surgeries
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Manage surgery organisations and their settings.
            </p>
          </div>

          {/* Search Box */}
          <AdminSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search surgeries…"
            debounceMs={0}
          />

          {/* Table */}
          <AdminTable
            columns={[
              {
                header: 'Surgery Name',
                key: 'name',
                render: (surgery) => (
                  <div className="text-sm font-medium text-gray-900">{surgery.name}</div>
                ),
              },
              {
                header: 'User Count',
                key: 'userCount',
                render: (surgery) => (
                  <div className="text-sm text-gray-500">
                    {surgery._count.users} {surgery._count.users === 1 ? 'user' : 'users'}
                  </div>
                ),
              },
              {
                header: 'Members Preview',
                key: 'members',
                className: 'whitespace-normal',
                render: (surgery) => {
                  const first2Users = surgery.users.slice(0, 2)
                  const extraCount = surgery.users.length - 2

                  if (surgery.users.length === 0) {
                    return <span className="text-sm text-gray-400 italic">No members</span>
                  }

                  return (
                    <div className="flex flex-wrap gap-2">
                      {first2Users.map((membership) => (
                        <Badge
                          key={membership.id}
                          color={membership.role === 'ADMIN' ? 'green' : 'blue'}
                          size="sm"
                          pill={false}
                        >
                          {membership.user.name || membership.user.email} ({membership.role})
                        </Badge>
                      ))}
                      {extraCount > 0 && (
                        <Badge color="gray" size="sm" pill={false}>
                          +{extraCount} more
                        </Badge>
                      )}
                    </div>
                  )
                },
              },
              {
                header: 'Actions',
                key: 'actions',
                render: (surgery) => (
                  <div className="flex gap-2">
                    <Link
                      href={`/s/${surgery.id}/admin/users`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Manage Users
                    </Link>
                    <span className="text-gray-300">|</span>
                    <button
                      className="text-blue-600 hover:text-blue-900"
                      onClick={() => setEditingSurgery(surgery)}
                    >
                      Edit
                    </button>
                  </div>
                ),
              },
            ]}
            rows={filteredSurgeries}
            emptyMessage={searchQuery.trim() ? 'No surgeries match your search.' : 'No surgeries found.'}
            rowKey={(surgery) => surgery.id}
          />
        </div>
      </main>

      {/* Create Surgery Modal */}
      <Dialog
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Surgery"
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-surgery-form" loading={isLoading}>
              Create Surgery
            </Button>
          </>
        }
      >
        <form id="create-surgery-form" onSubmit={handleCreateSurgery}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Surgery Name
            </label>
            <Input
              id="name"
              required
              value={newSurgery.name}
              onChange={(e) => setNewSurgery({ ...newSurgery, name: e.target.value })}
              placeholder="Ide Lane Surgery"
            />
          </div>
        </form>
      </Dialog>

      {/* Edit Surgery Modal */}
      <Dialog
        open={!!editingSurgery}
        onClose={() => setEditingSurgery(null)}
        title="Edit Surgery"
        width="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingSurgery(null)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" form="edit-surgery-form" loading={isLoading}>
              {isLoading ? 'Updating...' : 'Update Surgery'}
            </Button>
          </>
        }
      >
        {editingSurgery && (
          <>
            <form id="edit-surgery-form" onSubmit={handleUpdateSurgery}>
              <div className="mb-4">
                <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Surgery Name
                </label>
                <Input
                  id="edit-name"
                  name="name"
                  required
                  defaultValue={editingSurgery.name}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="edit-adminEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Email
                </label>
                <Input
                  type="email"
                  id="edit-adminEmail"
                  name="adminEmail"
                  defaultValue={editingSurgery.adminEmail || ''}
                />
              </div>
              <div className="mb-6">
                <label htmlFor="edit-adminPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Password (leave blank to keep current)
                </label>
                <Input
                  type="password"
                  id="edit-adminPassword"
                  name="adminPassword"
                  placeholder="Leave blank to keep current"
                />
              </div>
            </form>

            {/* Change awareness baselines section */}
            <div className="mt-4 pt-6 border-t border-gray-200">
              <h4 className="text-md font-medium text-gray-900 mb-2">
                Change awareness baselines
              </h4>
              <p className="text-sm text-gray-500 mb-4">
                Set baseline dates to filter out initial import/migration noise from &quot;What&apos;s changed&quot; feeds.
                Changes before these dates will not appear.
              </p>

              {isLoadingBaselines ? (
                <div className="text-sm text-gray-500 py-4 text-center">Loading baseline dates...</div>
              ) : (
                <div className="space-y-4">
                  {/* Symptom Library baseline */}
                  <div>
                    <label htmlFor="signposting-baseline" className="block text-sm font-medium text-gray-700 mb-1">
                      Symptom Library changes from
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        id="signposting-baseline"
                        value={baselineDates.signpostingBaseline || ''}
                        onChange={(e) => setBaselineDates(prev => ({ ...prev, signpostingBaseline: e.target.value || null }))}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBaselineToToday('signpostingBaseline')}
                        title="Set to today"
                      >
                        Today
                      </Button>
                      {baselineDates.signpostingBaseline && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setBaselineDates(prev => ({ ...prev, signpostingBaseline: null }))}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          title="Clear"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Practice Handbook baseline */}
                  <div>
                    <label htmlFor="handbook-baseline" className="block text-sm font-medium text-gray-700 mb-1">
                      Practice Handbook changes from
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        id="handbook-baseline"
                        value={baselineDates.practiceHandbookBaseline || ''}
                        onChange={(e) => setBaselineDates(prev => ({ ...prev, practiceHandbookBaseline: e.target.value || null }))}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBaselineToToday('practiceHandbookBaseline')}
                        title="Set to today"
                      >
                        Today
                      </Button>
                      {baselineDates.practiceHandbookBaseline && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setBaselineDates(prev => ({ ...prev, practiceHandbookBaseline: null }))}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          title="Clear"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Save baselines button */}
                  <div className="flex justify-end pt-2">
                    <Button
                      variant="success"
                      onClick={handleSaveBaselines}
                      loading={isSavingBaselines}
                    >
                      {isSavingBaselines ? 'Saving...' : 'Save Baselines'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </Dialog>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-md shadow-lg z-50 ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
