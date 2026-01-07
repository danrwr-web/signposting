'use client'

import { useState } from 'react'
import { WorkflowNodeType } from '@prisma/client'
import { upsertTemplateStyleDefault, resetTemplateStyleDefaults } from '@/app/s/[id]/workflow/actions'

interface TemplateStyleDefault {
  nodeType: WorkflowNodeType
  bgColor: string | null
  textColor: string | null
  borderColor: string | null
}

interface Props {
  surgeryId: string
  templateId: string
  styleDefaults: TemplateStyleDefault[]
  onUpdate: () => void
}

const NODE_TYPE_LABELS: Record<WorkflowNodeType, string> = {
  INSTRUCTION: 'Instruction',
  QUESTION: 'Question',
  END: 'End/Outcome',
  PANEL: 'Panel',
  REFERENCE: 'Reference',
}

export default function TemplateStyleDefaultsEditor({ surgeryId, templateId, styleDefaults, onUpdate }: Props) {
  const [editingDefaults, setEditingDefaults] = useState<Map<WorkflowNodeType, TemplateStyleDefault>>(() => {
    const map = new Map<WorkflowNodeType, TemplateStyleDefault>()
    const nodeTypes: WorkflowNodeType[] = ['INSTRUCTION', 'QUESTION', 'END', 'PANEL', 'REFERENCE']
    for (const nodeType of nodeTypes) {
      const existing = styleDefaults.find(d => d.nodeType === nodeType)
      map.set(nodeType, existing || { nodeType, bgColor: null, textColor: null, borderColor: null })
    }
    return map
  })
  const [saving, setSaving] = useState<WorkflowNodeType | null>(null)
  const [resetting, setResetting] = useState<WorkflowNodeType | null>(null)

  const handleSave = async (nodeType: WorkflowNodeType) => {
    const defaultStyle = editingDefaults.get(nodeType)
    if (!defaultStyle) return

    setSaving(nodeType)
    try {
      const result = await upsertTemplateStyleDefault(
        surgeryId,
        templateId,
        nodeType,
        defaultStyle.bgColor || null,
        defaultStyle.textColor || null,
        defaultStyle.borderColor || null
      )
      if (result.success) {
        onUpdate()
      } else {
        alert(`Failed to save: ${result.error}`)
      }
    } catch (error) {
      console.error('Error saving style default:', error)
      alert('Failed to save style default')
    } finally {
      setSaving(null)
    }
  }

  const handleReset = async (nodeType: WorkflowNodeType) => {
    setResetting(nodeType)
    try {
      const result = await resetTemplateStyleDefaults(surgeryId, templateId, nodeType)
      if (result.success) {
        // Update local state
        setEditingDefaults(prev => {
          const next = new Map(prev)
          next.set(nodeType, { nodeType, bgColor: null, textColor: null, borderColor: null })
          return next
        })
        onUpdate()
      } else {
        alert(`Failed to reset: ${result.error}`)
      }
    } catch (error) {
      console.error('Error resetting style default:', error)
      alert('Failed to reset style default')
    } finally {
      setResetting(null)
    }
  }

  const updateDefault = (nodeType: WorkflowNodeType, field: 'bgColor' | 'textColor' | 'borderColor', value: string) => {
    setEditingDefaults(prev => {
      const next = new Map(prev)
      const current = next.get(nodeType) || { nodeType, bgColor: null, textColor: null, borderColor: null }
      next.set(nodeType, { ...current, [field]: value || null })
      return next
    })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Node Style Defaults</h3>
      <p className="text-sm text-gray-600 mb-6">
        Set default colours for each node type. These apply to all nodes unless individually customised.
      </p>
      
      <div className="space-y-4">
        {(['INSTRUCTION', 'QUESTION', 'END', 'PANEL', 'REFERENCE'] as WorkflowNodeType[]).map((nodeType) => {
          const defaultStyle = editingDefaults.get(nodeType) || { nodeType, bgColor: null, textColor: null, borderColor: null }
          const isSaving = saving === nodeType
          const isResetting = resetting === nodeType
          
          return (
            <div key={nodeType} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">{NODE_TYPE_LABELS[nodeType]}</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(nodeType)}
                    disabled={isSaving || isResetting}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => handleReset(nodeType)}
                    disabled={isSaving || isResetting}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResetting ? 'Resetting...' : 'Reset'}
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Background</label>
                  <input
                    type="color"
                    value={defaultStyle.bgColor || '#ffffff'}
                    onChange={(e) => updateDefault(nodeType, 'bgColor', e.target.value)}
                    className="w-full h-8 border border-gray-300 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Text</label>
                  <input
                    type="color"
                    value={defaultStyle.textColor || '#111827'}
                    onChange={(e) => updateDefault(nodeType, 'textColor', e.target.value)}
                    className="w-full h-8 border border-gray-300 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Border</label>
                  <input
                    type="color"
                    value={defaultStyle.borderColor || '#e5e7eb'}
                    onChange={(e) => updateDefault(nodeType, 'borderColor', e.target.value)}
                    className="w-full h-8 border border-gray-300 rounded cursor-pointer"
                  />
                </div>
              </div>
              
              {/* Preview */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-600 mb-1">Preview:</div>
                <div
                  className="px-3 py-2 rounded border text-sm"
                  style={{
                    backgroundColor: defaultStyle.bgColor || '#ffffff',
                    color: defaultStyle.textColor || '#111827',
                    borderColor: defaultStyle.borderColor || '#e5e7eb',
                  }}
                >
                  {NODE_TYPE_LABELS[nodeType]} node preview
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

