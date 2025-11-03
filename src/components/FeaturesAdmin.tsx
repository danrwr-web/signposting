'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'

interface Surgery {
  id: string
  name: string
  slug?: string | null
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

interface SessionUser {
  id: string
  email: string
  globalRole: string
  surgeryId?: string
}

interface FeaturesAdminProps {
  currentUser: SessionUser
  selectedSurgeryId: string | null
}

export default function FeaturesAdmin({ currentUser, selectedSurgeryId }: FeaturesAdminProps) {
  const [features, setFeatures] = useState<Feature[]>([])
  const [surgeries, setSurgeries] = useState<Surgery[]>([])
  const [surgeryFeatures, setSurgeryFeatures] = useState<Feature[]>([])
  const [users, setUsers] = useState<UserWithFeatures[]>([])
  const [loading, setLoading] = useState(false)
  const [currentSurgeryId, setCurrentSurgeryId] = useState<string | null>(selectedSurgeryId)

  const isSuperuser = currentUser.globalRole === 'SUPERUSER'
  const isPracticeAdmin = currentUser.globalRole !== 'SUPERUSER' && currentUser.surgeryId !== undefined

  // Load surgeries (for superuser selector)
  useEffect(() => {
    if (isSuperuser) {
      fetch('/api/admin/surgeries')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setSurgeries(data)
          }
        })
        .catch(err => {
          console.error('Error loading surgeries:', err)
        })
    }
  }, [isSuperuser])

  // Load features, surgery features, and user features
  useEffect(() => {
    const loadData = async () => {
      if (!currentSurgeryId) return

      setLoading(true)
      try {
        // Load all features
        const featuresRes = await fetch('/api/features')
        if (!featuresRes.ok) throw new Error('Failed to load features')
        const featuresData = await featuresRes.json()
        setFeatures(featuresData.features || [])

        // Load surgery features
        const surgeryFeaturesRes = await fetch(`/api/surgeryFeatures?surgeryId=${currentSurgeryId}`)
        if (!surgeryFeaturesRes.ok) throw new Error('Failed to load surgery features')
        const surgeryFeaturesData = await surgeryFeaturesRes.json()
        setSurgeryFeatures(surgeryFeaturesData.features || [])

        // Load user features
        const userFeaturesRes = await fetch(`/api/userFeatures?surgeryId=${currentSurgeryId}`)
        if (!userFeaturesRes.ok) throw new Error('Failed to load user features')
        const userFeaturesData = await userFeaturesRes.json()
        setUsers(userFeaturesData.users || [])
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('Failed to load features data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [currentSurgeryId])

  const handleSurgeryFeatureToggle = async (featureId: string, enabled: boolean) => {
    if (!currentSurgeryId) return

    try {
      const res = await fetch('/api/surgeryFeatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surgeryId: currentSurgeryId,
          featureId,
          enabled
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update surgery feature')
      }

      toast.success('Surgery feature updated')
      
      // Reload surgery features
      const surgeryFeaturesRes = await fetch(`/api/surgeryFeatures?surgeryId=${currentSurgeryId}`)
      if (surgeryFeaturesRes.ok) {
        const data = await surgeryFeaturesRes.json()
        setSurgeryFeatures(data.features || [])
      }

      // Reload user features (since controls may change)
      const userFeaturesRes = await fetch(`/api/userFeatures?surgeryId=${currentSurgeryId}`)
      if (userFeaturesRes.ok) {
        const data = await userFeaturesRes.json()
        setUsers(data.users || [])
      }
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
    if (!currentSurgeryId || users.length === 0) return

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
      
      results.forEach((result, index) => {
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

      // Reload user features
      const userFeaturesRes = await fetch(`/api/userFeatures?surgeryId=${currentSurgeryId}`)
      if (userFeaturesRes.ok) {
        const data = await userFeaturesRes.json()
        setUsers(data.users || [])
      }
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
    <div className="space-y-6">
      {/* Surgery Selector (Superuser only) */}
      {isSuperuser && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <label className="block text-sm font-medium text-nhs-dark-blue mb-2">
            Select Surgery
          </label>
          <select
            value={currentSurgeryId || ''}
            onChange={e => setCurrentSurgeryId(e.target.value || null)}
            className="w-full nhs-input"
          >
            <option value="">Select a surgery...</option>
            {surgeries.map(surgery => (
              <option key={surgery.id} value={surgery.id}>
                {surgery.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!currentSurgeryId ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-nhs-grey">Please select a surgery to manage features</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel A: Surgery-level Features */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-nhs-dark-blue mb-4">
              Surgery Features
            </h3>
            <p className="text-sm text-nhs-grey mb-4">
              {isSuperuser
                ? 'Enable or disable features for this surgery'
                : 'View which features are enabled for your surgery'}
            </p>

            {loading ? (
              <p className="text-nhs-grey">Loading...</p>
            ) : surgeryFeatures.length === 0 ? (
              <p className="text-nhs-grey">No features found</p>
            ) : (
              <div className="space-y-4">
                {surgeryFeatures.map(feature => (
                  <div key={feature.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-nhs-dark-blue">{feature.name}</h4>
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

          {/* Panel B: User-level Overrides */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-nhs-dark-blue mb-4">
              User Access for this Surgery
            </h3>

            {/* Enable for All dropdown */}
            {(isSuperuser || isPracticeAdmin) && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-nhs-dark-blue">
                    Enable for all users:
                  </label>
                  <select
                    onChange={e => {
                      if (e.target.value) {
                        handleEnableForAll(e.target.value)
                        e.target.value = ''
                      }
                    }}
                    className="flex-1 nhs-input text-sm"
                  >
                    <option value="">Select a feature...</option>
                    {features.map(feature => (
                      <option key={feature.id} value={feature.id}>
                        {feature.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {loading ? (
              <p className="text-nhs-grey">Loading...</p>
            ) : users.length === 0 ? (
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
                          {feature.name}
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
                            <div className="text-nhs-grey">{user.email}</div>
                          </div>
                        </td>
                        {features.map(feature => {
                          const userFeature = user.features.find(f => f.featureId === feature.id)
                          const enabled = userFeature?.enabled || false
                          const surgeryEnabled = isSurgeryFeatureEnabled(feature.id)
                          const canToggle = (isSuperuser || isPracticeAdmin) && surgeryEnabled

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
                                    : undefined
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
        </div>
      )}
    </div>
  )
}

