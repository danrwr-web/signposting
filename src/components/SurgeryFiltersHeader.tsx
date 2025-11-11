'use client'

import { RefObject } from 'react'
import SearchBox from './SearchBox'
import AgeFilter from './AgeFilter'
import HighRiskButtons from './HighRiskButtons'
import { useCardStyle } from '@/context/CardStyleContext'

type Letter = 'All' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
type AgeBand = 'All' | 'Under5' | '5to17' | 'Adult'

const LETTERS: Letter[] = [
  'All',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
]

interface SurgeryFiltersHeaderProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedLetter: Letter
  onLetterChange: (letter: Letter) => void
  selectedAge: AgeBand
  onAgeChange: (age: AgeBand) => void
  resultsCount: number
  totalCount: number
  currentSurgeryId?: string
  searchInputRef: RefObject<HTMLInputElement>
}

export default function SurgeryFiltersHeader({
  searchTerm,
  onSearchChange,
  selectedLetter,
  onLetterChange,
  selectedAge,
  onAgeChange,
  resultsCount,
  totalCount,
  currentSurgeryId,
  searchInputRef
}: SurgeryFiltersHeaderProps) {
  const { headerLayout } = useCardStyle()
  const activeLayout = headerLayout ?? 'split'

  const renderAlphabetButtons = () =>
    LETTERS.map((letter) => {
      const isSelected = letter === selectedLetter

      return (
        <button
          key={letter}
          type="button"
          onClick={() => onLetterChange(letter)}
          className={[
            'h-9 w-9 rounded-full border text-sm flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2',
            isSelected
              ? 'bg-nhs-blue text-white border-nhs-blue'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400',
          ].join(' ')}
          aria-pressed={isSelected}
        >
          {letter}
        </button>
      )
    })

  if (activeLayout === 'classic') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <div className="lg:flex lg:items-start lg:gap-6">
          <div className="flex-1">
            <div className="max-w-2xl w-full mx-auto lg:mx-0">
              <SearchBox
                ref={searchInputRef}
                value={searchTerm}
                onChange={onSearchChange}
                placeholder="Search symptoms... (Press / to focus)"
                debounceMs={250}
              />

              <div
                className="mt-2 text-sm text-nhs-grey text-left lg:text-right"
                aria-live="polite"
              >
                {resultsCount} of {totalCount}
                {selectedLetter !== 'All' && ` (${selectedLetter})`}
              </div>

              <AgeFilter
                value={selectedAge}
                onChange={onAgeChange}
                className="mt-4 flex flex-col gap-2 items-start"
              />

              <div className="mt-4 flex justify-center">
                <div className="grid grid-cols-9 gap-2 max-w-lg">
                  {renderAlphabetButtons()}
                </div>
              </div>
            </div>
          </div>

          <aside className="lg:w-72 w-full lg:shrink-0 lg:mt-[10px] mt-6">
            <div className="bg-white rounded-xl shadow-sm px-2.5 py-3">
              <HighRiskButtons surgeryId={currentSurgeryId} className="grid-cols-1 gap-2" />
            </div>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
      <div className="lg:flex lg:items-start lg:gap-6">
        <div className="flex-1">
          <div className="max-w-2xl w-full mx-auto lg:mx-0">
            <SearchBox
              ref={searchInputRef}
              value={searchTerm}
              onChange={onSearchChange}
              placeholder="Search symptoms... (Press / to focus)"
              debounceMs={250}
            />

            <div
              className="mt-2 text-sm text-nhs-grey text-left lg:text-right"
              aria-live="polite"
            >
              {resultsCount} of {totalCount}
              {selectedLetter !== 'All' && ` (${selectedLetter})`}
            </div>

            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
              <div className="flex flex-col gap-2">
                <AgeFilter
                  value={selectedAge}
                  onChange={onAgeChange}
                  className="flex flex-col gap-2 items-start"
                />
              </div>

              <div className="flex-1 flex justify-center">
                <div className="grid grid-cols-9 gap-2 max-w-lg">
                  {renderAlphabetButtons()}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:w-72 w-full lg:shrink-0 lg:mt-[10px] mt-6">
          <div className="bg-white rounded-xl shadow-sm px-2.5 py-3">
            <HighRiskButtons surgeryId={currentSurgeryId} className="lg:grid-cols-2" />
          </div>
        </aside>
      </div>
    </div>
  )
}

