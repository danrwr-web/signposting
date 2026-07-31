'use client'

import RichTextEditor from '@/components/rich-text/RichTextEditor'
import type { ImageUploadTarget } from '@/components/rich-text/toolbar/ImagePopover'
import { sanitizeSymptomHtml } from '@/lib/sanitizeHtml'

export interface VariantGroupDraft {
  key: string
  label: string
  instructions: string
}

interface VariantGroupsEditorProps {
  /** Prefix for the rich-text editors' docIds, unique per editing context. */
  docIdPrefix: string
  heading: string
  onHeadingChange: (value: string) => void
  position: 'before' | 'after'
  onPositionChange: (value: 'before' | 'after') => void
  groups: VariantGroupDraft[]
  onGroupsChange: (groups: VariantGroupDraft[]) => void
  /** Enables inline image uploads in the variant instruction editors. */
  imageUpload?: ImageUploadTarget
}

/**
 * Shared editor for a symptom's age-group variants (heading, position and the
 * per-age-group instruction list). Used by the symptom page's variant panels
 * and the new-symptom dialog.
 */
export default function VariantGroupsEditor({
  docIdPrefix,
  heading,
  onHeadingChange,
  position,
  onPositionChange,
  groups,
  onGroupsChange,
  imageUpload,
}: VariantGroupsEditorProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-nhs-dark-blue mb-1">Heading (optional)</label>
          <input
            type="text"
            value={heading}
            onChange={(e) => onHeadingChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue"
            placeholder="e.g., Choose Age Group"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-nhs-dark-blue mb-1">Position</label>
          <select
            value={position}
            onChange={(e) => onPositionChange(e.target.value as 'before' | 'after')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhs-blue focus:border-nhs-blue"
          >
            <option value="before">Before instructions</option>
            <option value="after">After instructions</option>
          </select>
        </div>
      </div>

      {groups.map((group, idx) => (
        <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
            <input
              type="text"
              value={group.label}
              onChange={(e) => {
                const updated = [...groups]
                updated[idx] = {
                  ...updated[idx],
                  label: e.target.value,
                  key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                }
                onGroupsChange(updated)
              }}
              placeholder="Label (e.g., Under 5)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <input
              type="text"
              value={group.key}
              onChange={(e) => {
                const updated = [...groups]
                updated[idx] = { ...updated[idx], key: e.target.value }
                onGroupsChange(updated)
              }}
              placeholder="Key"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <label className="block text-sm font-medium text-nhs-dark-blue mb-1">Instructions</label>
          <RichTextEditor
            docId={`${docIdPrefix}:variant:${group.key || String(idx)}`}
            value={group.instructions}
            onChange={(html) => {
              const sanitized = sanitizeSymptomHtml(html)
              const updated = [...groups]
              updated[idx] = { ...updated[idx], instructions: sanitized }
              onGroupsChange(updated)
            }}
            placeholder="Enter detailed instructions for this variant..."
            height={180}
            imageUpload={imageUpload}
          />
          <button
            type="button"
            onClick={() => onGroupsChange(groups.filter((_, i) => i !== idx))}
            className="mt-2 text-sm text-red-600 hover:text-red-800"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onGroupsChange([...groups, { key: '', label: '', instructions: '' }])}
        className="text-sm text-nhs-blue hover:text-nhs-dark-blue"
      >
        + Add Variant
      </button>
    </div>
  )
}
