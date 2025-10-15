/**
 * Age filter component for symptom filtering
 * Client component with accessibility features
 */

'use client'

type AgeBand = 'All' | 'Under5' | '5to17' | 'Adult'

interface AgeFilterProps {
  value: AgeBand
  onChange: (value: AgeBand) => void
}

export default function AgeFilter({ value, onChange }: AgeFilterProps) {
  const bands: AgeBand[] = ['All', 'Under5', '5to17', 'Adult']

  return (
    <div role="tablist" aria-label="Age filter" className="flex gap-2">
      {bands.map((band) => (
        <button
          key={band}
          role="tab"
          aria-selected={value === band}
          onClick={() => onChange(band)}
          className={`px-3 py-1 rounded-full border transition-colors ${
            value === band 
              ? 'bg-blue-600 text-white border-blue-600' 
              : 'bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300'
          }`}
        >
          {band === 'Under5' ? 'Under 5' : band === '5to17' ? '5–17' : band}
        </button>
      ))}
    </div>
  )
}