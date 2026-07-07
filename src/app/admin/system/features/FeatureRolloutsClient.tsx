'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import SimpleHeader from '@/components/SimpleHeader'
import { Dialog, Button } from '@/components/ui'
import { FEATURE_HIDE_AGE_BANDS } from '@/lib/featureKeys'
import { formatAgeGroupLabel } from '@/lib/ageGroups'

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

// Mirrors the response of POST /api/admin/symptoms/collapse-age-duplicates
interface CollapseCandidate {
  baseSymptomId: string
  ageGroup: 'U5' | 'O5' | 'Adult'
  source: 'base' | 'override'
}
interface CollapsePlan {
  groups: Array<{
    name: string
    kept: CollapseCandidate
    disabled: CollapseCandidate[]
    reason: 'override' | 'latest-override' | 'age-preference'
  }>
  counts: { duplicateGroups: number; disabledCount: number; keptCount: number }
  skippedCustomDuplicates: string[]
}

interface FeatureRolloutsClientProps {
  surgeries: Surgery[]
  features: Feature[]
  flagsMap: Record<string, Record<string, boolean>>
}

// Display name override for admin_toolkit
function getDisplayName(feature: Feature): string {
  if (feature.key === 'admin_toolkit') {
    return 'Practice Handbook'
  }
  return feature.name
}

// Core modules vs AI features
const CORE_MODULE_KEYS = ['workflow_guidance', 'admin_toolkit']
const AI_FEATURE_KEYS = ['ai_instructions', 'ai_training', 'ai_surgery_customisation']

export default function FeatureRolloutsClient({
  surgeries,
  features,
  flagsMap: initialFlagsMap,
}: FeatureRolloutsClientProps) {
  const [flagsMap, setFlagsMap] = useState(initialFlagsMap)
  const [updating, setUpdating] = useState<string | null>(null)
  // Collapse-duplicates dialog shown when enabling hide_age_bands (or re-run per surgery)
  const [collapseDialog, setCollapseDialog] = useState<{ surgeryId: string; surgeryName: string; plan: CollapsePlan } | null>(null)
  const [collapsePreviewing, setCollapsePreviewing] = useState<string | null>(null)
  const [collapseExecuting, setCollapseExecuting] = useState(false)

  const fetchCollapsePlan = async (surgeryId: string, mode: 'preview' | 'execute'): Promise<CollapsePlan | null> => {
    const res = await fetch('/api/admin/symptoms/collapse-age-duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surgeryId, mode }),
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      throw new Error(error.error || 'Failed to check for duplicate age versions')
    }
    return res.json()
  }

  // Preview duplicate age versions for a surgery and open the confirm dialog.
  // Called after enabling hide_age_bands, and from the per-surgery re-run action.
  const openCollapseDialog = async (surgery: Surgery, silentWhenClean = false) => {
    setCollapsePreviewing(surgery.id)
    try {
      const plan = await fetchCollapsePlan(surgery.id, 'preview')
      if (!plan) return
      if (plan.counts.duplicateGroups === 0 && plan.skippedCustomDuplicates.length === 0) {
        if (!silentWhenClean) {
          toast.success('No duplicate age versions found for this surgery')
        }
        return
      }
      setCollapseDialog({ surgeryId: surgery.id, surgeryName: surgery.name, plan })
    } catch (error) {
      console.error('Error previewing duplicate age versions:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to check for duplicate age versions')
    } finally {
      setCollapsePreviewing(null)
    }
  }

  const executeCollapse = async () => {
    if (!collapseDialog) return
    setCollapseExecuting(true)
    try {
      const result = await fetchCollapsePlan(collapseDialog.surgeryId, 'execute')
      toast.success(`Disabled ${result?.counts.disabledCount ?? 0} duplicate age version${(result?.counts.disabledCount ?? 0) === 1 ? '' : 's'}`)
      setCollapseDialog(null)
    } catch (error) {
      console.error('Error collapsing duplicate age versions:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to disable duplicates')
    } finally {
      setCollapseExecuting(false)
    }
  }

  // Separate features into core modules and AI features
  const coreModules = features.filter(f => CORE_MODULE_KEYS.includes(f.key))
  const aiFeatures = features.filter(f => AI_FEATURE_KEYS.includes(f.key))

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

      // Turning on "Hide age bands" leaves duplicate same-name symptoms with no
      // visible differentiator, so offer to disable the duplicates right away.
      const toggledFeature = features.find(f => f.id === featureId)
      if (toggledFeature?.key === FEATURE_HIDE_AGE_BANDS && enabled) {
        const surgery = surgeries.find(s => s.id === surgeryId)
        if (surgery) {
          await openCollapseDialog(surgery, true)
        }
      }
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

      toast.success(`${getDisplayName(feature)} enabled for ${successCount} surgeries`)
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

      toast.success(`${getDisplayName(feature)} disabled for ${successCount} surgeries`)
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

        {/* Core modules section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">Core modules</h2>
          <p className="text-sm text-nhs-grey mb-4">
            Core modules are practice-wide. When enabled, all users in a surgery can access the module.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {coreModules.map(feature => {
              const enabledCount = getEnabledCount(feature.id)
              const percentage = surgeries.length > 0 
                ? Math.round((enabledCount / surgeries.length) * 100) 
                : 0

              return (
                <div key={feature.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-nhs-dark-blue">{getDisplayName(feature)}</h3>
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
        </div>

        {/* AI features section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">AI & advanced features</h2>
          <p className="text-sm text-nhs-grey mb-4">
            AI features require practice-level enablement first, then can be assigned to individual users.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {aiFeatures.map(feature => {
              const enabledCount = getEnabledCount(feature.id)
              const percentage = surgeries.length > 0 
                ? Math.round((enabledCount / surgeries.length) * 100) 
                : 0

              return (
                <div key={feature.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-nhs-dark-blue">{getDisplayName(feature)}</h3>
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
                        {getDisplayName(feature)}
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
                        const isHideAgeBands = feature.key === FEATURE_HIDE_AGE_BANDS

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
                              aria-label={`Toggle ${getDisplayName(feature)} for ${surgery.name}`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  enabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            {isHideAgeBands && enabled && (
                              <button
                                onClick={() => openCollapseDialog(surgery)}
                                disabled={collapsePreviewing === surgery.id}
                                className="block mx-auto mt-1 text-[11px] text-nhs-blue hover:text-nhs-dark-blue underline disabled:opacity-50"
                                title="Check for duplicate age versions of symptoms and disable the extras so one card shows per symptom"
                              >
                                {collapsePreviewing === surgery.id ? 'Checking…' : 'Collapse duplicates'}
                              </button>
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

      {/* Collapse duplicate age versions dialog */}
      <Dialog
        open={!!collapseDialog}
        onClose={() => setCollapseDialog(null)}
        title="Disable duplicate age versions?"
        description={collapseDialog ? `${collapseDialog.surgeryName} hides age bands, so duplicate age versions of the same symptom appear as identical cards. Keep one version per symptom and disable the rest?` : undefined}
        footer={
          collapseDialog && (
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setCollapseDialog(null)} disabled={collapseExecuting}>
                Not now
              </Button>
              {collapseDialog.plan.counts.disabledCount > 0 && (
                <Button variant="primary" onClick={executeCollapse} loading={collapseExecuting}>
                  Disable {collapseDialog.plan.counts.disabledCount} duplicate{collapseDialog.plan.counts.disabledCount === 1 ? '' : 's'}
                </Button>
              )}
            </div>
          )
        }
      >
        {collapseDialog && (
          <div className="space-y-4">
            {collapseDialog.plan.groups.length > 0 && (
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
                {collapseDialog.plan.groups.map(group => (
                  <li key={group.kept.baseSymptomId} className="px-3 py-2 text-sm">
                    <span className="font-medium text-gray-900">{group.name}</span>
                    <span className="text-gray-600">
                      {' '}— keeping {formatAgeGroupLabel(group.kept.ageGroup)}
                      {(group.reason === 'override' || group.reason === 'latest-override') && ' (locally edited)'}
                      , disabling {group.disabled.map(d => formatAgeGroupLabel(d.ageGroup)).join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {collapseDialog.plan.skippedCustomDuplicates.length > 0 && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
                Skipped (involves practice-created symptoms, resolve manually in the Symptom Library):{' '}
                {collapseDialog.plan.skippedCustomDuplicates.join(', ')}
              </p>
            )}
            <p className="text-xs text-gray-500">
              Disabled symptoms can be re-enabled individually from the Symptom Library. The surgery&apos;s front page can take up to a minute to reflect changes.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  )
}
