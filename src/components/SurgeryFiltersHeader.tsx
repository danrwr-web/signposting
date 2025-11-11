'use client'

import { RefObject } from 'react'
import SearchBox from './SearchBox'
import AgeFilter from './AgeFilter'
import HighRiskButtons from './HighRiskButtons'
import AlphabetStrip from './AlphabetStrip'
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

  if (activeLayout === 'classic') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <div className="flex items-center gap-4 justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="max-w-md w-full">
              <SearchBox
                ref={searchInputRef}
                value={searchTerm}
                onChange={onSearchChange}
                placeholder="Search symptoms... (Press / to focus)"
                debounceMs={250}
              />
            </div>
            <AgeFilter
              value={selectedAge}
              onChange={onAgeChange}
              orientation="horizontal"
            />
          </div>
          <div className="text-sm text-nhs-grey" aria-live="polite">
            {resultsCount} of {totalCount}
            {selectedLetter !== 'All' && ` (${selectedLetter})`}
          </div>
        </div>

        <div className="mt-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 pb-2 min-w-max">
            <HighRiskButtons
              surgeryId={currentSurgeryId}
              variant="classic"
            />
          </div>
        </div>

        <div className="mt-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 pb-2 min-w-max">
            {LETTERS.map((letter) => {
              const isSelected = selectedLetter === letter

              return (
                <button
                  key={letter}
                  onClick={() => onLetterChange(letter)}
                  className={[
                    'h-9 min-w-9 px-0 rounded-full border text-sm flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2',
                    isSelected
                      ? 'bg-nhs-blue text-white border-nhs-blue'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400',
                  ].join(' ')}
                  aria-pressed={isSelected}
                >
                  {letter}
                </button>
              )
            })}
          </div>
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
                  orientation="vertical"
                />
              </div>

              <div className="flex-1 flex justify-center">
                <AlphabetStrip
                  selected={selectedLetter}
                  onSelect={onLetterChange}
                  size="sm"
                  className="grid grid-cols-9 gap-2 max-w-lg"
                />
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:w-72 w-full lg:shrink-0 lg:mt-2 mt-6">
          <div className="bg-white rounded-xl shadow-sm px-2.5 py-3">
            <HighRiskButtons
              surgeryId={currentSurgeryId}
              variant="split"
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

