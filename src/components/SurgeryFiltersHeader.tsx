'use client'

import { RefObject } from 'react'
import SearchBox from './SearchBox'
import AgeFilter from './AgeFilter'
import AlphabetStrip from './AlphabetStrip'
import HighRiskButtons from './HighRiskButtons'

type Letter = 'All' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
type AgeBand = 'All' | 'Under5' | '5to17' | 'Adult'

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
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
      <div className="lg:flex lg:items-start lg:gap-6">
        <div className="flex-1">
          <div className="max-w-3xl mx-auto w-full">
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
              className="mt-4 flex flex-col gap-3"
            />

            <div className="mt-6">
              <AlphabetStrip
                selected={selectedLetter}
                onSelect={onLetterChange}
                size="sm"
                className="grid grid-cols-8 gap-2 justify-items-center mx-auto max-w-md"
              />
            </div>
          </div>
        </div>

        <aside className="lg:w-72 w-full lg:shrink-0 lg:mt-0 mt-6">
          <div className="bg-white rounded-xl shadow-sm border p-3 flex flex-col gap-3">
            <HighRiskButtons surgeryId={currentSurgeryId} className="flex flex-col gap-3" />
          </div>
        </aside>
      </div>
    </div>
  )
}

