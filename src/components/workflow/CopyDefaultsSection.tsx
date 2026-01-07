'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Template {
  id: string
  name: string
}

interface Props {
  surgeryId: string
  targetTemplateId: string
  allTemplates: Template[]
  isSuperuser: boolean
}

export default function CopyDefaultsSection({ surgeryId, targetTemplateId, allTemplates, isSuperuser }: Props) {
  const router = useRouter()
  const [sourceTemplateId, setSourceTemplateId] = useState<string>('')
  const [overwrite, setOverwrite] = useState<boolean>(true)
  const [isCopying, setIsCopying] = useState(false)
  const [isSettingSurgeryDefaults, setIsSettingSurgeryDefaults] = useState(false)

  const handleCopyDefaults = async () => {
    if (!sourceTemplateId) {
      alert('Please select a source template')
      return
    }

    if (!confirm(`Copy defaults from "${allTemplates.find(t => t.id === sourceTemplateId)?.name}" to the selected template?`)) {
      return
    }

    setIsCopying(true)
    try {
      const response = await fetch(`/s/${surgeryId}/workflow/templates/${targetTemplateId}/style-defaults/copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceTemplateId,
          overwrite,
        }),
      })

      const result = await response.json()
      if (result.success) {
        router.refresh()
        alert('Defaults copied successfully!')
      } else {
        alert(`Failed to copy: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error copying defaults:', error)
      alert('Failed to copy defaults')
    } finally {
      setIsCopying(false)
    }
  }

  const handleSetSurgeryDefaults = async () => {
    if (!confirm('Set surgery defaults from this template? This will update the surgery-level defaults used for new nodes and templates without explicit defaults.')) {
      return
    }

    setIsSettingSurgeryDefaults(true)
    try {
      const response = await fetch(`/s/${surgeryId}/workflow/admin/style-defaults/from-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: targetTemplateId,
        }),
      })

      const result = await response.json()
      if (result.success) {
        router.refresh()
        alert('Surgery defaults updated successfully!')
      } else {
        alert(`Failed to set surgery defaults: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error setting surgery defaults:', error)
      alert('Failed to set surgery defaults')
    } finally {
      setIsSettingSurgeryDefaults(false)
    }
  }

  if (!isSuperuser) {
    return null
  }

  // Filter out the target template from source options
  const sourceTemplates = allTemplates.filter(t => t.id !== targetTemplateId)

  if (sourceTemplates.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Copy defaults from another template</h3>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="source-template" className="block text-sm font-medium text-gray-700 mb-2">
            Source template
          </label>
          <select
            id="source-template"
            value={sourceTemplateId}
            onChange={(e) => setSourceTemplateId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- Select a template --</option>
            {sourceTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center">
          <input
            id="overwrite-checkbox"
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="overwrite-checkbox" className="ml-2 block text-sm text-gray-700">
            Overwrite existing template defaults
          </label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleCopyDefaults}
            disabled={!sourceTemplateId || isCopying || isSettingSurgeryDefaults}
            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCopying ? 'Copying...' : 'Copy defaults to selected template'}
          </button>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <button
          onClick={handleSetSurgeryDefaults}
          disabled={isCopying || isSettingSurgeryDefaults}
          className="px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSettingSurgeryDefaults ? 'Setting...' : 'Set surgery defaults from this template'}
        </button>
        <p className="text-xs text-gray-500 mt-2">
          This copies this template's defaults to the surgery-level defaults, which are used for new nodes and templates without explicit defaults.
        </p>
      </div>
    </div>
  )
}

