'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import SimpleHeader from '@/components/SimpleHeader'

interface SurgeryBaseline {
  id: string
  name: string
  slug: string | null
  signpostingBaseline: string | null
  signpostingBaselineFormatted: string | null
  signpostingBaselineActive: boolean
  handbookBaseline: string | null
  handbookBaselineFormatted: string | null
  handbookBaselineActive: boolean
}

interface ChangeAwarenessClientProps {
  globalWindowDays: number
  surgeries: SurgeryBaseline[]
}

export default function ChangeAwarenessClient({
  globalWindowDays,
  surgeries: initialSurgeries,
}: ChangeAwarenessClientProps) {
  const [surgeries, setSurgeries] = useState(initialSurgeries)
  const [editingSurgeryId, setEditingSurgeryId] = useState<string | null>(null)
  const [editSignposting, setEditSignposting] = useState<string>('')
  const [editHandbook, setEditHandbook] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const handleEditClick = (surgery: SurgeryBaseline) => {
    setEditingSurgeryId(surgery.id)
    // Convert ISO to YYYY-MM-DD for date input
    setEditSignposting(surgery.signpostingBaseline ? surgery.signpostingBaseline.split('T')[0] : '')
    setEditHandbook(surgery.handbookBaseline ? surgery.handbookBaseline.split('T')[0] : '')
  }

  const handleCancelEdit = () => {
    setEditingSurgeryId(null)
    setEditSignposting('')
    setEditHandbook('')
  }

  const handleSave = async (surgeryId: string) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/surgeries/${surgeryId}/baselines`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signpostingBaseline: editSignposting || null,
          practiceHandbookBaseline: editHandbook || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save baselines')
      }

      const result = await response.json()

      // Update local state
      setSurgeries(prev => prev.map(s => {
        if (s.id !== surgeryId) return s
        
        const signpostingDate = result.signpostingBaseline ? new Date(result.signpostingBaseline) : null
        const handbookDate = result.practiceHandbookBaseline ? new Date(result.practiceHandbookBaseline) : null
        
        const windowCutoff = new Date()
        windowCutoff.setDate(windowCutoff.getDate() - globalWindowDays)
        
        return {
          ...s,
          signpostingBaseline: result.signpostingBaseline,
          signpostingBaselineFormatted: signpostingDate ? signpostingDate.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }) : null,
          signpostingBaselineActive: signpostingDate ? signpostingDate > windowCutoff : false,
          handbookBaseline: result.practiceHandbookBaseline,
          handbookBaselineFormatted: handbookDate ? handbookDate.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }) : null,
          handbookBaselineActive: handbookDate ? handbookDate > windowCutoff : false,
        }
      }))

      toast.success('Baselines updated successfully')
      handleCancelEdit()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save baselines')
    } finally {
      setSaving(false)
    }
  }

  const activeBaselineCount = surgeries.filter(
    s => s.signpostingBaselineActive || s.handbookBaselineActive
  ).length

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={[]} currentSurgeryId={undefined} />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8">
          <nav className="text-sm text-nhs-grey mb-2">
            <Link href="/admin" className="hover:text-nhs-blue">
              Settings
            </Link>
            <span className="mx-2">/</span>
            <Link href="/admin/system" className="hover:text-nhs-blue">
              System management
            </Link>
            <span className="mx-2">/</span>
            <span>Change awareness</span>
          </nav>
          <h1 className="text-3xl font-bold text-nhs-dark-blue">
            Change awareness & history
          </h1>
          <p className="text-nhs-grey mt-2">
            Control how and when changes appear in &quot;What&apos;s changed&quot; feeds across all modules.
          </p>
        </div>

        {/* Global settings card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-nhs-dark-blue mb-4">
            Global settings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-nhs-grey">Recent changes window</h3>
              <p className="text-2xl font-semibold text-nhs-blue mt-1">
                {globalWindowDays} days
              </p>
              <p className="text-sm text-nhs-grey mt-1">
                Default rolling window for all surgeries
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-nhs-grey">Active surgery baselines</h3>
              <p className="text-2xl font-semibold text-nhs-blue mt-1">
                {activeBaselineCount} of {surgeries.length}
              </p>
              <p className="text-sm text-nhs-grey mt-1">
                Surgeries with custom baseline dates in effect
              </p>
            </div>
          </div>
        </div>

        {/* Per-surgery baselines */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-nhs-dark-blue">
              Per-surgery baselines
            </h2>
            <p className="text-sm text-nhs-grey mt-1">
              Set baseline dates to exclude changes before a certain date from &quot;What&apos;s changed&quot; feeds.
              Useful for newly onboarded surgeries to avoid initial import noise.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Surgery
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Signposting baseline
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Handbook baseline
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {surgeries.map((surgery) => (
                  <tr key={surgery.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {surgery.name}
                      </div>
                      {surgery.slug && (
                        <div className="text-xs text-gray-500">
                          {surgery.slug}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingSurgeryId === surgery.id ? (
                        <input
                          type="date"
                          value={editSignposting}
                          onChange={(e) => setEditSignposting(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : surgery.signpostingBaselineFormatted ? (
                        <div>
                          <span className="text-sm text-gray-900">
                            {surgery.signpostingBaselineFormatted}
                          </span>
                          {surgery.signpostingBaselineActive && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not set</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingSurgeryId === surgery.id ? (
                        <input
                          type="date"
                          value={editHandbook}
                          onChange={(e) => setEditHandbook(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : surgery.handbookBaselineFormatted ? (
                        <div>
                          <span className="text-sm text-gray-900">
                            {surgery.handbookBaselineFormatted}
                          </span>
                          {surgery.handbookBaselineActive && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not set</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {editingSurgeryId === surgery.id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={handleCancelEdit}
                            disabled={saving}
                            className="px-3 py-1 text-gray-600 hover:text-gray-800"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSave(surgery.id)}
                            disabled={saving}
                            className="px-3 py-1 bg-nhs-blue text-white rounded hover:bg-nhs-dark-blue disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditClick(surgery)}
                          className="text-nhs-blue hover:text-nhs-dark-blue"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {surgeries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No surgeries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info panel */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-nhs-blue flex-shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-nhs-dark-blue">
                How baselines work
              </h3>
              <p className="text-sm text-nhs-grey mt-1">
                The effective cutoff for &quot;What&apos;s changed&quot; is the later of: the rolling window cutoff ({globalWindowDays} days ago) 
                OR the surgery&apos;s baseline date. A baseline marked &quot;Active&quot; means it&apos;s currently more restrictive than 
                the rolling window.
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex gap-4">
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
