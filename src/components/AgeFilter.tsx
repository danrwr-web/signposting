/**
 * Age filter component for symptom filtering
 * Client component with accessibility features
 */

'use client'

type AgeBand = 'All' | 'Under5' | '5to17' | 'Adult'

interface AgeFilterProps {
  value: AgeBand
  onChange: (value: AgeBand) => void
  className?: string
}

export default function AgeFilter({ value, onChange, className }: AgeFilterProps) {
  const bands: AgeBand[] = ['All', 'Under5', '5to17', 'Adult']

  const containerClasses = className ?? 'flex flex-col gap-2 mt-3'

  return (
    <div
      role="tablist"
      aria-label="Age filter"
      aria-orientation="vertical"
      className={containerClasses}
    >
      {bands.map((band) => (
        <button
          key={band}
          role="tab"
          aria-selected={value === band}
          onClick={() => onChange(band)}
          className={`px-4 py-1 rounded-full text-sm font-medium border transition-colors ${
            value === band 
              ? 'bg-blue-600 text-white border-blue-600' 
              : 'bg-slate-200 text-slate-700 border-transparent hover:bg-slate-300'
          }`}
        >
          {band === 'Under5' ? 'Under 5' : band === '5to17' ? '5–17' : band}
        </button>
      ))}
    </div>
  )
}