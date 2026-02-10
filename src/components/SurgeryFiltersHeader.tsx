'use client'

import { RefObject } from 'react'
import Link from 'next/link'
import SearchBox from './SearchBox'
import AgeFilter from './AgeFilter'
import HighRiskButtons from './HighRiskButtons'
import CommonReasonsRow from './CommonReasonsRow'
import { useCardStyle } from '@/context/CardStyleContext'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'
import { CommonReasonsResolvedItem } from '@/lib/commonReasons'

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
  symptoms?: EffectiveSymptom[]
  commonReasonsItems?: CommonReasonsResolvedItem[]
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
  searchInputRef,
  symptoms,
  commonReasonsItems
}: SurgeryFiltersHeaderProps) {
  const { headerLayout, highRiskStyle } = useCardStyle()
  const activeLayout = headerLayout ?? 'split'

  if (activeLayout === 'classic') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        {/* row 1: search + ages (left), count (right) */}
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

            {/* horizontal age filters */}
            <div className="flex items-center gap-2">
              <AgeFilter
                value={selectedAge}
                onChange={onAgeChange}
                orientation="horizontal"
              />
            </div>
          </div>

          {/* count on the same row, right aligned */}
          <div className="text-sm text-nhs-grey shrink-0" aria-live="polite">
            {resultsCount} of {totalCount}
            {selectedLetter !== 'All' && ` (${selectedLetter})`}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex gap-3 pb-2 min-w-max">
              <HighRiskButtons
                surgeryId={currentSurgeryId}
                variant="classic"
                appearance={highRiskStyle ?? 'pill'}
              />
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href="/daily-dose"
              className="flex flex-col justify-center rounded-lg border border-nhs-blue bg-white px-3 py-2 text-left shadow-sm transition-colors hover:bg-nhs-light-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2 min-w-[140px]"
              aria-label="Daily Dose, try the learning app"
            >
              <span className="text-xs font-semibold text-nhs-dark-blue leading-tight">Daily Dose</span>
              <span className="text-[10px] text-nhs-grey leading-tight">Try the learning app.</span>
            </Link>
            <Link
              href={currentSurgeryId ? `/s/${currentSurgeryId}/clinical-tools` : '/clinical-tools'}
              className="flex flex-col justify-center rounded-lg border border-nhs-blue bg-white px-3 py-2 text-left shadow-sm transition-colors hover:bg-nhs-light-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2 min-w-[140px]"
              aria-label="Clinical tools for GPs and Nurses"
            >
              <span className="text-xs font-semibold text-nhs-dark-blue leading-tight">Clinical tools</span>
              <span className="text-[10px] text-nhs-grey leading-tight">For GPs and Nurses.</span>
            </Link>
          </div>
        </div>

        {commonReasonsItems && commonReasonsItems.length > 0 && (
          <CommonReasonsRow items={commonReasonsItems} surgeryId={currentSurgeryId} />
        )}

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
            {/* row 1: search + count on the same line */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <SearchBox
                  ref={searchInputRef}
                  value={searchTerm}
                  onChange={onSearchChange}
                  placeholder="Search symptoms... (Press / to focus)"
                  debounceMs={250}
                />
              </div>
              <div className="text-sm text-nhs-grey shrink-0" aria-live="polite">
                {resultsCount} of {totalCount}
                {selectedLetter !== 'All' && ` (${selectedLetter})`}
              </div>
            </div>

            <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
              {/* left: age pills */}
              <div className="flex flex-col gap-2">
                <AgeFilter
                  value={selectedAge}
                  onChange={onAgeChange}
                  className="flex flex-col gap-2 items-start"
                  orientation="vertical"
                />
              </div>

              {/* centre: alphabet */}
              <div className="flex-1 flex justify-center">
                <div className="grid grid-cols-9 gap-2 max-w-lg">
                  {LETTERS.map((letter) => {
                    const isSelected = selectedLetter === letter
                    return (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => onLetterChange(letter)}
                        className={[
                          'h-9 w-9 rounded-full border text-sm flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2',
                          isSelected
                            ? 'bg-nhs-blue text-white border-nhs-blue'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
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

            {commonReasonsItems && commonReasonsItems.length > 0 && (
              <CommonReasonsRow items={commonReasonsItems} surgeryId={currentSurgeryId} />
            )}
          </div>
        </div>

        <aside className="lg:w-80 w-full lg:shrink-0 lg:mt-2 mt-6">
          <div className="bg-white rounded-xl shadow-sm px-2.5 py-3">
            <HighRiskButtons
              surgeryId={currentSurgeryId}
              variant="split"
              appearance={highRiskStyle ?? 'pill'}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

