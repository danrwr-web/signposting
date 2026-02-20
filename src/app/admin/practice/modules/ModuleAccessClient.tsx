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

// Core modules - practice-wide only, no user-level control
const CORE_MODULE_KEYS = ['workflow_guidance', 'admin_toolkit']

// AI features - support user-level overrides
const AI_FEATURE_KEYS = ['ai_instructions', 'ai_training', 'ai_surgery_customisation']

// Display name override for admin_toolkit
function getDisplayName(feature: Feature): string {
  if (feature.key === 'admin_toolkit') {
    return 'Practice Handbook'
  }
  return feature.name
}

// Get description override
function getDisplayDescription(feature: Feature): string | null {
  if (feature.key === 'admin_toolkit') {
    return 'Enable the Practice Handbook module (practice guidance pages, lists, rota and pinned panel).'
  }
  return feature.description || null
}

export default function ModuleAccessClient({
  surgeries,
  primarySurgeryId,
  isSuperuser,
}: ModuleAccessClientProps) {
  const [selectedSurgeryId, setSelectedSurgeryId] = useState<string>(
    primarySurgeryId || surgeries[0]?.id || ''
  )
  const [features, setFeatures] = useState<Feature[]>([])
  const [surgeryFeatures, setSurgeryFeatures] = useState<Feature[]>([])
  const [users, setUsers] = useState<UserWithFeatures[]>([])
  const [loading, setLoading] = useState(false)

  const selectedSurgery = surgeries.find(s => s.id === selectedSurgeryId)

  // Separate features into core modules and AI features
  const coreModules = surgeryFeatures.filter(f => CORE_MODULE_KEYS.includes(f.key))
  const aiFeatures = surgeryFeatures.filter(f => AI_FEATURE_KEYS.includes(f.key))
  const aiFeaturesList = features.filter(f => AI_FEATURE_KEYS.includes(f.key))

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
        toast.success('Feature updated')
      }
      
      // Reload data
      await loadData()
    } catch (error) {
      console.error('Error toggling surgery feature:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update feature')
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
      if (!surgeryFeature || !surgeryFeature.enabled) {
        toast.error('This feature must be enabled at practice level first')
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
      
      let successCount = 0
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.ok) {
          successCount++
        }
      })

      toast.success(`Enabled for ${successCount} ${successCount === 1 ? 'user' : 'users'}`)

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
            Control which modules and features are available for {selectedSurgery?.name || 'this surgery'}.
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
          <div className="space-y-8">
            {/* Section A: Core modules (practice-wide) */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-nhs-dark-blue">
                  Core modules
                </h2>
                <p className="text-sm text-nhs-grey mt-1">
                  Core modules are enabled for the whole practice. When a module is on, all users with access to this surgery can use it.
                </p>
              </div>

              {coreModules.length === 0 ? (
                <p className="text-nhs-grey">No core modules found.</p>
              ) : (
                <div className="space-y-4">
                  {coreModules.map(feature => (
                    <div key={feature.id} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium text-nhs-dark-blue">
                              {getDisplayName(feature)}
                            </h3>
                            {feature.enabled ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 mr-1">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                Enabled for all users
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                Disabled for this practice
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-nhs-grey mt-1">
                            {getDisplayDescription(feature)}
                          </p>
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
                            aria-label={`Toggle ${getDisplayName(feature)}`}
                            title={!isSuperuser ? 'Only super admins can change practice-wide settings' : undefined}
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

              {!isSuperuser && (
                <p className="text-xs text-nhs-grey mt-4 italic">
                  Only super admins can enable or disable core modules.
                </p>
              )}
            </div>

            {/* Section B: AI & advanced features */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-nhs-dark-blue">
                  AI & advanced features
                </h2>
                <p className="text-sm text-nhs-grey mt-1">
                  AI features can be enabled for individual users once switched on for the practice. 
                  A feature must be enabled at practice level before it can be given to users.
                </p>
              </div>

              {/* Practice-level AI feature toggles */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-nhs-dark-blue mb-3">
                  Practice-level access
                </h3>
                {aiFeatures.length === 0 ? (
                  <p className="text-nhs-grey">No AI features found.</p>
                ) : (
                  <div className="space-y-3">
                    {aiFeatures.map(feature => (
                      <div key={feature.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3 bg-gray-50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-nhs-dark-blue text-sm">
                              {getDisplayName(feature)}
                            </span>
                            {feature.enabled ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                Available
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                                Off
                              </span>
                            )}
                          </div>
                          {feature.description && (
                            <p className="text-xs text-nhs-grey mt-0.5">{feature.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleSurgeryFeatureToggle(feature.id, !feature.enabled)}
                          disabled={!isSuperuser}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            feature.enabled
                              ? 'bg-nhs-green'
                              : 'bg-gray-300'
                          } ${!isSuperuser ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          aria-label={`Toggle ${getDisplayName(feature)}`}
                          title={!isSuperuser ? 'Only super admins can change practice-wide settings' : undefined}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              feature.enabled ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* User-level AI feature overrides */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-nhs-dark-blue">
                    User-level access
                  </h3>
                  {/* Enable for all dropdown */}
                  {aiFeaturesList.some(f => isSurgeryFeatureEnabled(f.id)) && (
                    <select
                      onChange={e => {
                        if (e.target.value) {
                          handleEnableForAll(e.target.value)
                          e.target.value = ''
                        }
                      }}
                      className="text-xs px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-nhs-blue"
                    >
                      <option value="">Enable for all users...</option>
                      {aiFeaturesList.filter(f => isSurgeryFeatureEnabled(f.id)).map(feature => (
                        <option key={feature.id} value={feature.id}>
                          {getDisplayName(feature)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {users.length === 0 ? (
                  <p className="text-sm text-nhs-grey">No users found for this surgery.</p>
                ) : aiFeaturesList.length === 0 ? (
                  <p className="text-sm text-nhs-grey">No AI features available.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            User
                          </th>
                          {aiFeaturesList.map(feature => {
                            const practiceEnabled = isSurgeryFeatureEnabled(feature.id)
                            return (
                              <th
                                key={feature.id}
                                className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase"
                              >
                                <div className="flex flex-col items-center gap-1">
                                  <span>{getDisplayName(feature)}</span>
                                  {!practiceEnabled && (
                                    <span className="text-red-500 text-[10px] normal-case font-normal">
                                      (off for practice)
                                    </span>
                                  )}
                                </div>
                              </th>
                            )
                          })}
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
                            {aiFeaturesList.map(feature => {
                              const userFeature = user.features.find(f => f.featureId === feature.id)
                              const enabled = userFeature?.enabled || false
                              const practiceEnabled = isSurgeryFeatureEnabled(feature.id)

                              return (
                                <td key={feature.id} className="px-3 py-3 text-center">
                                  {practiceEnabled ? (
                                    <button
                                      onClick={() => handleUserFeatureToggle(user.id, feature.id, !enabled)}
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                                        enabled ? 'bg-nhs-green' : 'bg-gray-300'
                                      }`}
                                      title={enabled ? 'Enabled for this user' : 'Disabled for this user'}
                                      aria-label={`Toggle ${getDisplayName(feature)} for ${user.name || user.email}`}
                                    >
                                      <span
                                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                          enabled ? 'translate-x-5' : 'translate-x-0.5'
                                        }`}
                                      />
                                    </button>
                                  ) : (
                                    <span 
                                      className="inline-flex items-center justify-center w-9 h-5 text-gray-300"
                                      title="Enable this feature at practice level first"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                      </svg>
                                    </span>
                                  )}
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
                    <li><strong>Core modules</strong> are practice-wide: on means everyone can use it.</li>
                    <li><strong>AI features</strong> need to be switched on for the practice first, then enabled for individual users.</li>
                    <li>A locked icon (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 inline"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>) means the feature is off for the whole practice.</li>
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
