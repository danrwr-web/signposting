'use client'

import { sanitizeAndFormatSymptomContent } from '@/lib/sanitizeHtml'
import { RichContent } from '@/components/ui'

interface VariantPreviewListProps {
  /** Raw variants JSON from the API — parsed defensively. */
  variants: unknown
}

/**
 * Read-only rendering of a symptom's age-group variants for preview drawers
 * (Symptom Library and Clinical Review). Renders nothing when the symptom has
 * no variants.
 */
export default function VariantPreviewList({ variants }: VariantPreviewListProps) {
  const v = variants as any
  const ageGroups: any[] = v?.ageGroups && Array.isArray(v.ageGroups) ? v.ageGroups : []
  if (ageGroups.length === 0) return null

  const position = v.position === 'after' ? 'after' : 'before'

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {typeof v.heading === 'string' && v.heading.trim() !== '' ? v.heading : 'Age-group variants'}
        </div>
        <div className="text-xs text-gray-400">Shown {position} the main instructions</div>
      </div>
      <div className="space-y-3">
        {ageGroups.map((group: any, idx: number) => (
          <div key={group.key || idx} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <span className="mb-2 inline-flex items-center rounded-full bg-nhs-blue px-2.5 py-0.5 text-xs font-medium text-white">
              {group.label || group.key || `Variant ${idx + 1}`}
            </span>
            <RichContent
              className="prose prose-sm max-w-none text-nhs-grey"
              html={sanitizeAndFormatSymptomContent(group.instructions || '')}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
