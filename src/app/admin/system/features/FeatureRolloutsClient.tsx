'use client'

import { useState } from 'react'
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
  description: string | null
}

interface FeatureRolloutsClientProps {
  surgeries: Surgery[]
  features: Feature[]
  flagsMap: Record<string, Record<string, boolean>>
}

export default function FeatureRolloutsClient({
  surgeries,
  features,
  flagsMap: initialFlagsMap,
}: FeatureRolloutsClientProps) {
  const [flagsMap, setFlagsMap] = useState(initialFlagsMap)
  const [updating, setUpdating] = useState<string | null>(null)

  const handleToggle = async (surgeryId: string, featureId: string, enabled: boolean) => {
    const key = `${surgeryId}-${featureId}`
    setUpdating(key)

    try {
      const res = await fetch('/api/surgeryFeatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surgeryId,
          featureId,
          enabled
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update feature')
      }

      // Update local state
      setFlagsMap(prev => ({
        ...prev,
        [surgeryId]: {
          ...prev[surgeryId],
          [featureId]: enabled
        }
      }))

      toast.success('Feature updated')
    } catch (error) {
      console.error('Error toggling feature:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update feature')
    } finally {
      setUpdating(null)
    }
  }

  const handleEnableForAll = async (featureId: string) => {
    const feature = features.find(f => f.id === featureId)
    if (!feature) return

    try {
      const promises = surgeries.map(surgery =>
        fetch('/api/surgeryFeatures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            surgeryId: surgery.id,
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

      // Update local state
      setFlagsMap(prev => {
        const newMap = { ...prev }
        surgeries.forEach(surgery => {
          newMap[surgery.id] = {
            ...newMap[surgery.id],
            [featureId]: true
          }
        })
        return newMap
      })

      toast.success(`${feature.name} enabled for ${successCount} surgeries`)
    } catch (error) {
      console.error('Error enabling for all:', error)
      toast.error('Failed to enable for all surgeries')
    }
  }

  const handleDisableForAll = async (featureId: string) => {
    const feature = features.find(f => f.id === featureId)
    if (!feature) return

    try {
      const promises = surgeries.map(surgery =>
        fetch('/api/surgeryFeatures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            surgeryId: surgery.id,
            featureId,
            enabled: false
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

      // Update local state
      setFlagsMap(prev => {
        const newMap = { ...prev }
        surgeries.forEach(surgery => {
          newMap[surgery.id] = {
            ...newMap[surgery.id],
            [featureId]: false
          }
        })
        return newMap
      })

      toast.success(`${feature.name} disabled for ${successCount} surgeries`)
    } catch (error) {
      console.error('Error disabling for all:', error)
      toast.error('Failed to disable for all surgeries')
    }
  }

  const getEnabledCount = (featureId: string): number => {
    return surgeries.filter(s => flagsMap[s.id]?.[featureId]).length
  }

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={[]} currentSurgeryId={undefined} />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header with breadcrumbs */}
        <div className="mb-8">
          <nav className="text-sm text-nhs-grey mb-2">
            <Link href="/admin/system" className="hover:text-nhs-blue">
              System management
            </Link>
            <span className="mx-2">/</span>
            <span>Feature rollouts</span>
          </nav>
          <h1 className="text-3xl font-bold text-nhs-dark-blue">
            Feature rollouts
          </h1>
          <p className="text-nhs-grey mt-2">
            Control which features are available to each surgery. Enable or disable features globally, 
            or configure them on a per-surgery basis.
          </p>
        </div>

        {/* Feature overview cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {features.map(feature => {
            const enabledCount = getEnabledCount(feature.id)
            const percentage = surgeries.length > 0 
              ? Math.round((enabledCount / surgeries.length) * 100) 
              : 0

            return (
              <div key={feature.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-nhs-dark-blue">{feature.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    percentage === 100 
                      ? 'bg-green-100 text-green-800' 
                      : percentage === 0 
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {enabledCount}/{surgeries.length}
                  </span>
                </div>
                {feature.description && (
                  <p className="text-xs text-nhs-grey mb-3">{feature.description}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEnableForAll(feature.id)}
                    className="flex-1 text-xs px-2 py-1 bg-nhs-green text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Enable all
                  </button>
                  <button
                    onClick={() => handleDisableForAll(feature.id)}
                    className="flex-1 text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                  >
                    Disable all
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Detailed surgery x feature matrix */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">
            Surgery feature matrix
          </h2>
          
          {surgeries.length === 0 ? (
            <p className="text-nhs-grey">No surgeries found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50">
                      Surgery
                    </th>
                    {features.map(feature => (
                      <th
                        key={feature.id}
                        className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase"
                      >
                        {feature.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {surgeries.map(surgery => (
                    <tr key={surgery.id}>
                      <td className="px-4 py-3 text-sm font-medium text-nhs-dark-blue sticky left-0 bg-white">
                        {surgery.name}
                      </td>
                      {features.map(feature => {
                        const enabled = flagsMap[surgery.id]?.[feature.id] || false
                        const isUpdating = updating === `${surgery.id}-${feature.id}`

                        return (
                          <td key={feature.id} className="px-3 py-3 text-center">
                            <button
                              onClick={() => handleToggle(surgery.id, feature.id, !enabled)}
                              disabled={isUpdating}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                enabled
                                  ? 'bg-nhs-green'
                                  : 'bg-gray-300'
                              } ${isUpdating ? 'opacity-50' : 'cursor-pointer'}`}
                              aria-label={`Toggle ${feature.name} for ${surgery.name}`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  enabled ? 'translate-x-6' : 'translate-x-1'
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
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-nhs-blue flex-shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-nhs-dark-blue">
                About feature rollouts
              </h3>
              <p className="text-sm text-nhs-grey mt-1">
                This page controls which features are available at the <strong>surgery level</strong>. 
                Once a feature is enabled for a surgery, practice admins can then control which 
                individual users have access via the Module Access page in Practice settings.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8">
          <Link
            href="/admin/system"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-nhs-grey hover:bg-gray-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to System management
          </Link>
        </div>
      </main>
    </div>
  )
}
