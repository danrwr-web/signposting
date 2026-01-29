'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import SimpleHeader from '@/components/SimpleHeader'

interface Surgery {
  id: string
  name: string
  slug: string | null
}

interface Feature {
  id: string
  key: string
  name: string
  description?: string | null
  enabled?: boolean
}

interface UserWithFeatures {
  id: string
  name: string | null
  email: string
  features: Array<{
    featureId: string
    enabled: boolean
  }>
}

interface ModuleAccessClientProps {
  surgeries: Surgery[]
  primarySurgeryId: string | null
  isSuperuser: boolean
  currentUserId: string
  currentUserEmail: string
}

export default function ModuleAccessClient({
  surgeries,
  primarySurgeryId,
  isSuperuser,
  currentUserId,
  currentUserEmail,
}: ModuleAccessClientProps) {
  const [selectedSurgeryId, setSelectedSurgeryId] = useState<string>(
    primarySurgeryId || surgeries[0]?.id || ''
  )
  const [features, setFeatures] = useState<Feature[]>([])
  const [surgeryFeatures, setSurgeryFeatures] = useState<Feature[]>([])
  const [users, setUsers] = useState<UserWithFeatures[]>([])
  const [loading, setLoading] = useState(false)

  const selectedSurgery = surgeries.find(s => s.id === selectedSurgeryId)

  // Load features, surgery features, and user features
  const loadData = useCallback(async () => {
    if (!selectedSurgeryId) return

    setLoading(true)
    try {
      // Load all features
      const featuresRes = await fetch('/api/features')
      if (!featuresRes.ok) throw new Error('Failed to load features')
      const featuresData = await featuresRes.json()
      setFeatures(featuresData.features || [])

      // Load surgery features
      const surgeryFeaturesRes = await fetch(`/api/surgeryFeatures?surgeryId=${selectedSurgeryId}`)
      if (!surgeryFeaturesRes.ok) throw new Error('Failed to load surgery features')
      const surgeryFeaturesData = await surgeryFeaturesRes.json()
      setSurgeryFeatures(surgeryFeaturesData.features || [])

      // Load user features
      const userFeaturesRes = await fetch(`/api/userFeatures?surgeryId=${selectedSurgeryId}`)
      if (!userFeaturesRes.ok) throw new Error('Failed to load user features')
      const userFeaturesData = await userFeaturesRes.json()
      setUsers(userFeaturesData.users || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load features data')
    } finally {
      setLoading(false)
    }
  }, [selectedSurgeryId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSurgeryFeatureToggle = async (featureId: string, enabled: boolean) => {
    if (!selectedSurgeryId) return

    try {
      const featureMeta = features.find((f) => f.id === featureId) || surgeryFeatures.find((f) => f.id === featureId)
      const res = await fetch('/api/surgeryFeatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surgeryId: selectedSurgeryId,
          featureId,
          enabled
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update surgery feature')
      }

      const json = await res.json().catch(() => null as Record<string, unknown> | null)
      if (featureMeta?.key === 'admin_toolkit' && enabled === true) {
        const seedStatus = (json as Record<string, Record<string, string>> | null)?.seedResult?.status
        if (seedStatus === 'seeded') {
          toast.success('Practice Handbook enabled and starter kit added')
        } else {
          toast.success('Practice Handbook enabled')
        }
      } else if (featureMeta?.key === 'admin_toolkit' && enabled === false) {
        toast.success('Practice Handbook disabled')
      } else {
        toast.success('Surgery feature updated')
      }
      
      // Reload data
      await loadData()
    } catch (error) {
      console.error('Error toggling surgery feature:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update surgery feature')
    }
  }

  const handleUserFeatureToggle = async (userId: string, featureId: string, enabled: boolean) => {
    try {
      const res = await fetch('/api/userFeatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          featureId,
          enabled
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update user feature')
      }

      toast.success('User feature updated')
      
      // Update local state
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId
            ? {
                ...user,
                features: user.features.map(f =>
                  f.featureId === featureId ? { ...f, enabled } : f
                )
              }
            : user
        )
      )
    } catch (error) {
      console.error('Error toggling user feature:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update user feature')
    }
  }

  const handleEnableForAll = async (featureId: string) => {
    if (!selectedSurgeryId || users.length === 0) return

    try {
      // Get surgery feature to check if it's enabled
      const surgeryFeature = surgeryFeatures.find(f => f.id === featureId)
      if (!isSuperuser && (!surgeryFeature || !surgeryFeature.enabled)) {
        toast.error('This feature is not enabled for this surgery')
        return
      }

      // Apply to all users
      const promises = users.map(user =>
        fetch('/api/userFeatures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            featureId,
            enabled: true
          })
        })
      )

      const results = await Promise.allSettled(promises)
      
      // Count successes and failures
      let successCount = 0
      let failureCount = 0
      
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.ok) {
          successCount++
        } else {
          failureCount++
        }
      })

      if (failureCount === 0) {
        toast.success(`Enabled for all ${successCount} users`)
      } else if (successCount > 0) {
        toast.success(`Enabled for ${successCount} users, ${failureCount} failed`)
      } else {
        toast.error('Failed to enable for users')
        return
      }

      // Reload data
      await loadData()
    } catch (error) {
      console.error('Error enabling for all users:', error)
      toast.error('Failed to enable for all users')
    }
  }

  const isSurgeryFeatureEnabled = (featureId: string): boolean => {
    const surgeryFeature = surgeryFeatures.find(f => f.id === featureId)
    return surgeryFeature?.enabled || false
  }

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={surgeries} currentSurgeryId={selectedSurgeryId} />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header with breadcrumbs */}
        <div className="mb-8">
          <nav className="text-sm text-nhs-grey mb-2">
            <Link href="/admin/practice" className="hover:text-nhs-blue">
              Practice settings
            </Link>
            <span className="mx-2">/</span>
            <span>Module access</span>
          </nav>
          <h1 className="text-3xl font-bold text-nhs-dark-blue">
            Module access
          </h1>
          <p className="text-nhs-grey mt-2">
            Control which modules and features are enabled for {selectedSurgery?.name || 'this surgery'}, 
            and manage user-level access.
          </p>
        </div>

        {/* Surgery selector (if multiple surgeries) */}
        {surgeries.length > 1 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <label htmlFor="surgery-select" className="block text-sm font-medium text-nhs-grey mb-2">
              Select surgery
            </label>
            <select
              id="surgery-select"
              value={selectedSurgeryId}
              onChange={(e) => setSelectedSurgeryId(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue"
            >
              {surgeries.map((surgery) => (
                <option key={surgery.id} value={surgery.id}>
                  {surgery.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* No surgery selected state */}
        {!selectedSurgeryId ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-nhs-grey">No surgery selected. Please select a surgery to manage.</p>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-nhs-grey">Loading features...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Section A: Practice-wide controls */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-nhs-dark-blue">
                  Practice-wide features
                </h2>
                <p className="text-sm text-nhs-grey mt-1">
                  {isSuperuser
                    ? 'Enable or disable features for this surgery. These settings apply to all users unless overridden below.'
                    : 'View which features are enabled for your surgery. Only super admins can change practice-wide settings.'}
                </p>
              </div>

              {surgeryFeatures.length === 0 ? (
                <p className="text-nhs-grey">No features found</p>
              ) : (
                <div className="space-y-4">
                  {surgeryFeatures.map(feature => (
                    <div key={feature.id} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-nhs-dark-blue">{feature.name}</h3>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              feature.enabled 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {feature.enabled ? 'Enabled for practice' : 'Disabled'}
                            </span>
                          </div>
                          {feature.description && (
                            <p className="text-sm text-nhs-grey mt-1">{feature.description}</p>
                          )}
                        </div>
                        <div className="flex items-center ml-4">
                          <button
                            onClick={() => handleSurgeryFeatureToggle(feature.id, !feature.enabled)}
                            disabled={!isSuperuser}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              feature.enabled
                                ? 'bg-nhs-green'
                                : 'bg-gray-300'
                            } ${!isSuperuser ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            aria-label={`Toggle ${feature.name}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                feature.enabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section B: User-level overrides */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-nhs-dark-blue">
                  User-level access
                </h2>
                <p className="text-sm text-nhs-grey mt-1">
                  Override feature access for individual users. A feature can only be enabled for a user if it is 
                  first enabled at the practice level above.
                </p>
              </div>

              {/* Enable for All dropdown */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-sm font-medium text-nhs-dark-blue">
                    Quick action:
                  </label>
                  <select
                    onChange={e => {
                      if (e.target.value) {
                        handleEnableForAll(e.target.value)
                        e.target.value = ''
                      }
                    }}
                    className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue"
                  >
                    <option value="">Enable a feature for all users...</option>
                    {features.filter(f => isSurgeryFeatureEnabled(f.id)).map(feature => (
                      <option key={feature.id} value={feature.id}>
                        {feature.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {users.length === 0 ? (
                <p className="text-nhs-grey">No users found for this surgery</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          User
                        </th>
                        {features.map(feature => (
                          <th
                            key={feature.id}
                            className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase"
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span>{feature.name}</span>
                              {!isSurgeryFeatureEnabled(feature.id) && (
                                <span className="text-red-500 text-[10px] normal-case">
                                  (disabled at practice)
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map(user => (
                        <tr key={user.id}>
                          <td className="px-4 py-3 text-sm">
                            <div>
                              <div className="font-medium text-nhs-dark-blue">{user.name || 'Unknown'}</div>
                              <div className="text-nhs-grey text-xs">{user.email}</div>
                            </div>
                          </td>
                          {features.map(feature => {
                            const userFeature = user.features.find(f => f.featureId === feature.id)
                            const enabled = userFeature?.enabled || false
                            const surgeryEnabled = isSurgeryFeatureEnabled(feature.id)
                            const canToggle = surgeryEnabled

                            return (
                              <td key={feature.id} className="px-2 py-3 text-center">
                                <button
                                  onClick={() => {
                                    if (canToggle) {
                                      handleUserFeatureToggle(user.id, feature.id, !enabled)
                                    }
                                  }}
                                  disabled={!canToggle}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    enabled && surgeryEnabled
                                      ? 'bg-nhs-green'
                                      : 'bg-gray-300'
                                  } ${
                                    !canToggle
                                      ? 'opacity-30 cursor-not-allowed'
                                      : 'cursor-pointer'
                                  }`}
                                  title={
                                    !surgeryEnabled
                                      ? 'This feature is disabled for this surgery.'
                                      : enabled
                                        ? 'Enabled for this user'
                                        : 'Disabled for this user'
                                  }
                                  aria-label={`Toggle ${feature.name} for ${user.name || user.email}`}
                                >
                                  <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      enabled && surgeryEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                  />
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Info panel */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-nhs-blue flex-shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-nhs-dark-blue">
                    How module access works
                  </h3>
                  <ul className="text-sm text-nhs-grey mt-1 list-disc list-inside space-y-1">
                    <li><strong>Practice-wide:</strong> Enable a module for the entire surgery. All users can then access it.</li>
                    <li><strong>User-level:</strong> Restrict or enable specific features for individual users within the practice.</li>
                    <li><strong>Constraint:</strong> A user cannot access a feature that is disabled at the practice level.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8">
          <Link
            href="/admin/practice"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-nhs-grey hover:bg-gray-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Practice settings
          </Link>
        </div>
      </main>
    </div>
  )
}
