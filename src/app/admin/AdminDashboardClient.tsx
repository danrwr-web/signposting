'use client'

import { useCallback, useRef, useState } from 'react'
import { signOut } from 'next-auth/react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { SessionUser } from '@/lib/rbac'
import { Surgery } from '@prisma/client'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'

interface SurgeryWithPendingCount extends Surgery {
  pendingReviewCount?: number
}

interface AdminDashboardClientProps {
  user: SessionUser
  surgeries: SurgeryWithPendingCount[]
  symptoms: EffectiveSymptom[]
  isSuperuser: boolean
}

export default function AdminDashboardClient({ 
  user, 
  surgeries, 
  symptoms, 
  isSuperuser 
}: AdminDashboardClientProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const canViewDocs = isSuperuser || user.memberships.some(m => m.role === 'ADMIN')
  const warmedSurgeriesRef = useRef<Set<string>>(new Set())

  const warmupSymptoms = useCallback((surgerySlug?: string | null) => {
    if (!surgerySlug || typeof window === 'undefined') return
    if (warmedSurgeriesRef.current.has(surgerySlug)) return
    warmedSurgeriesRef.current.add(surgerySlug)
    // Fire-and-forget to warm the cache; no UI changes
    fetch(`/api/symptoms?surgery=${surgerySlug}`, { cache: 'force-cache' }).catch(() => {})
  }, [])

  // Prefer a surgery the admin can manage; fall back to default
  const adminSurgeryId = !isSuperuser
    ? (user.memberships.find(m => m.role === 'ADMIN')?.surgeryId || user.defaultSurgeryId)
    : user.defaultSurgeryId

  const handleLogout = async () => {
    try {
      await signOut({ callbackUrl: '/' })
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Failed to logout')
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
                href={`/s/${user.defaultSurgeryId}`}
                prefetch
                onMouseEnter={() => warmupSymptoms(user.defaultSurgeryId)}
                onFocus={() => warmupSymptoms(user.defaultSurgeryId)}
                className="text-blue-600 hover:text-blue-500 mr-4"
              >
                ← Back to Signposting Tool
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                Settings
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                Welcome, {user.name || user.email}
                {isSuperuser && ' (System admin)'}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'surgery-management', label: 'Surgery Management' },
                ...(isSuperuser ? [{ id: 'super-admin', label: 'Super Admin' }] : []),
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              {canViewDocs && (
                <a
                  href="https://docs.signpostingtool.co.uk/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="py-4 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                >
                  Documentation
                </a>
              )}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Admin Overview
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-blue-50 p-6 rounded-lg">
                      <h3 className="text-lg font-medium text-blue-900">Surgeries</h3>
                      <p className="text-3xl font-bold text-blue-600 mt-2">
                        {surgeries.length}
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        {isSuperuser ? 'Total surgeries' : 'Your surgeries'}
                      </p>
                    </div>
                    <div className="bg-green-50 p-6 rounded-lg">
                      <h3 className="text-lg font-medium text-green-900">Symptoms</h3>
                      <p className="text-3xl font-bold text-green-600 mt-2">
                        {symptoms.length}
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        Base symptoms available
                      </p>
                    </div>
                    <div className="bg-purple-50 p-6 rounded-lg">
                      <h3 className="text-lg font-medium text-purple-900">Role</h3>
                      <p className="text-lg font-bold text-purple-600 mt-2">
                        {isSuperuser ? 'System admin' : 'Practice admin'}
                      </p>
                      <p className="text-sm text-purple-700 mt-1">
                        {isSuperuser ? 'Full system access' : 'Surgery-level access'}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Quick Actions
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Link
                      href={adminSurgeryId ? `/s/${adminSurgeryId}/clinical-review` : '#'}
                      className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
                    >
                      <h4 className="font-medium text-gray-900">Clinical Review</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Review and approve symptom guidance
                      </p>
                    </Link>
                    <Link
                      href={adminSurgeryId ? `/s/${adminSurgeryId}/admin/users` : '#'}
                      className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
                    >
                      <h4 className="font-medium text-gray-900">Manage Users</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Add, remove, and manage surgery users
                      </p>
                    </Link>
                    
                    <Link
                      href={adminSurgeryId ? `/s/${adminSurgeryId}` : '#'}
                      prefetch={!!adminSurgeryId}
                      onMouseEnter={() => warmupSymptoms(adminSurgeryId)}
                      onFocus={() => warmupSymptoms(adminSurgeryId)}
                      className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
                    >
                      <h4 className="font-medium text-gray-900">Launch Tool</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Open the signposting tool
                      </p>
                    </Link>

                    {isSuperuser && (
                      <Link
                        href="#super-admin"
                        onClick={() => setActiveTab('super-admin')}
                        className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
                      >
                        <h4 className="font-medium text-gray-900">Super Admin</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Global system management
                        </p>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Surgery Management Tab */}
            {activeTab === 'surgery-management' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Surgery Management
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Manage users and settings for your surgeries.
                  </p>
                </div>

                <div className="space-y-4">
                  {surgeries.map((surgery) => (
                    <div key={surgery.id} className="bg-white p-6 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            {surgery.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            ID: {surgery.id}
                          </p>
                        </div>
                        <div className="flex space-x-3">
                          <Link
                            href={`/s/${surgery.id}/clinical-review`}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                              surgery.pendingReviewCount && surgery.pendingReviewCount > 0
                                ? 'text-orange-700 bg-orange-50 hover:bg-orange-100'
                                : 'text-purple-600 bg-purple-50 hover:bg-purple-100'
                            }`}
                          >
                            Clinical Review
                            {surgery.pendingReviewCount && surgery.pendingReviewCount > 0 && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-200 text-orange-800">
                                {surgery.pendingReviewCount}
                              </span>
                            )}
                          </Link>
                          <Link
                            href={`/s/${surgery.id}/admin/users`}
                            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                          >
                            Manage Users
                          </Link>
                          <Link
                            href={`/s/${surgery.id}`}
                        prefetch
                        onMouseEnter={() => warmupSymptoms(surgery.id)}
                        onFocus={() => warmupSymptoms(surgery.id)}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                          >
                            Launch Tool
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Super Admin Tab */}
            {activeTab === 'super-admin' && isSuperuser && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Super Admin
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Global system management and administration.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Link
                    href="/admin/users"
                    className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Global User Management
                    </h3>
                    <p className="text-sm text-gray-600">
                      Manage all users across the system
                    </p>
                  </Link>

                  <Link
                    href="/admin/surgeries"
                    className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Surgery Management
                    </h3>
                    <p className="text-sm text-gray-600">
                      Create and manage surgeries
                    </p>
                  </Link>

                  <Link
                    href="/admin"
                    className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      System Administration
                    </h3>
                    <p className="text-sm text-gray-600">
                      Advanced system settings and tools
                    </p>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
