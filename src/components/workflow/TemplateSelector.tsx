'use client'

import { useRouter } from 'next/navigation'

interface TemplateSelectorProps {
  surgeryId: string
  templates: Array<{ id: string; name: string }>
  selectedTemplateId?: string
}

export default function TemplateSelector({ surgeryId, templates, selectedTemplateId }: TemplateSelectorProps) {
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    if (selectedId) {
      router.push(`/s/${surgeryId}/workflow/admin/styles?templateId=${selectedId}`)
    } else {
      router.push(`/s/${surgeryId}/workflow/admin/styles`)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <label htmlFor="template-select" className="block text-sm font-medium text-gray-700 mb-2">
        Select Template
      </label>
      <div className="flex gap-3">
        <select
          id="template-select"
          value={selectedTemplateId || ''}
          onChange={handleChange}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">-- Select a template --</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

