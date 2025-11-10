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
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-6">
        <div className="order-1 lg:order-none lg:col-start-1">
          <SearchBox
            ref={searchInputRef}
            value={searchTerm}
            onChange={onSearchChange}
            placeholder="Search symptoms... (Press / to focus)"
            debounceMs={250}
          />

          <div
            className="mt-2 text-sm text-nhs-grey lg:text-right"
            aria-live="polite"
          >
            {resultsCount} of {totalCount}
            {selectedLetter !== 'All' && ` (${selectedLetter})`}
          </div>
        </div>

        <div className="order-2 lg:order-none lg:col-start-1">
          <AgeFilter value={selectedAge} onChange={onAgeChange} />
        </div>

        <div className="order-4 lg:order-none lg:col-start-1">
          <AlphabetStrip
            selected={selectedLetter}
            onSelect={onLetterChange}
            size="sm"
            className="mt-4 flex flex-wrap justify-center gap-2 max-w-md mx-auto"
          />
        </div>

        <aside className="order-3 lg:order-none lg:col-start-2 lg:w-64 w-full lg:ml-4 lg:self-start mt-2 lg:mt-0">
          <div className="bg-white rounded-lg shadow-sm p-3 flex flex-col gap-2">
            <HighRiskButtons surgeryId={currentSurgeryId} />
          </div>
        </aside>
      </div>
    </div>
  )
}

