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
  orientation?: 'vertical' | 'horizontal'
}

export default function AgeFilter({ value, onChange, className, orientation = 'vertical' }: AgeFilterProps) {
  const bands: AgeBand[] = ['All', 'Under5', '5to17', 'Adult']

  const containerClasses =
    className ??
    (orientation === 'horizontal'
      ? 'flex items-center gap-2'
      : 'flex flex-col gap-2 mt-3')
  const baseClasses =
    'px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2'

  const getClassesForBand = (band: AgeBand, isSelected: boolean) => {
    if (band === 'All') {
      return [
        baseClasses,
        isSelected
          ? 'bg-nhs-blue text-white hover:bg-nhs-dark-blue'
          : 'bg-slate-100 text-slate-800 hover:bg-slate-200',
      ].join(' ')
    }

    const palette: Record<Exclude<AgeBand, 'All'>, { default: string; selected: string }> = {
      Under5: {
        default: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
        selected: 'bg-blue-200 text-blue-900 ring-2 ring-nhs-blue ring-offset-1',
      },
      '5to17': {
        default: 'bg-green-100 text-green-800 hover:bg-green-200',
        selected: 'bg-green-200 text-green-900 ring-2 ring-nhs-blue ring-offset-1',
      },
      Adult: {
        default: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
        selected: 'bg-purple-200 text-purple-900 ring-2 ring-nhs-blue ring-offset-1',
      },
    }

    const paletteEntry = palette[band]
    const colourClasses = isSelected ? paletteEntry.selected : paletteEntry.default

    return [baseClasses, colourClasses].join(' ')
  }

  return (
    <div
      role="tablist"
      aria-label="Age filter"
      aria-orientation={orientation}
      className={containerClasses}
    >
      {bands.map((band) => (
        <button
          key={band}
          role="tab"
          aria-selected={value === band}
          onClick={() => onChange(band)}
          className={getClassesForBand(band, value === band)}
        >
          {band === 'Under5' ? 'Under 5' : band === '5to17' ? '5–17' : band}
        </button>
      ))}
    </div>
  )
}