'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'

interface CommonReasonsRowProps {
  symptoms: EffectiveSymptom[]
  surgeryId?: string
}

// Hard-coded list of common symptom names to display
const COMMON_SYMPTOM_NAMES = [
  'Abdomen Pain',
  'Acid Reflux',
  'Acne',
  'Acute Medication Request',
  'Chest Infection',
  'Cough',
  'Earache',
  'Sore Throat',
]

export default function CommonReasonsRow({ symptoms, surgeryId }: CommonReasonsRowProps) {
  // Match hard-coded names against the provided symptoms list
  const matchedSymptoms = useMemo(() => {
    return COMMON_SYMPTOM_NAMES.map(name => {
      // Case-insensitive match
      const matched = symptoms.find(
        symptom => symptom.name.toLowerCase().trim() === name.toLowerCase().trim()
      )
      return matched ? { name, symptom: matched } : null
    }).filter((item): item is { name: string; symptom: EffectiveSymptom } => item !== null)
  }, [symptoms])

  // Don't render if no symptoms matched
  if (matchedSymptoms.length === 0) {
    return null
  }

  return (
    <div className="mt-3">
      <h2 className="text-sm font-medium text-nhs-grey mb-2 px-1">Common reasons for calling</h2>
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-2 min-w-max">
          {matchedSymptoms.map(({ name, symptom }) => {
            const href = `/symptom/${symptom.id}${surgeryId ? `?surgery=${surgeryId}` : ''}`
            return (
              <Link
                key={symptom.id}
                href={href}
                className="inline-flex items-center justify-center h-9 px-4 rounded-full bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2 whitespace-nowrap transition-colors"
              >
                {name}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

