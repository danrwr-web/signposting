'use client'

import { RefObject, useState, useEffect } from 'react'
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
  const [changesCount, setChangesCount] = useState<number | null>(null)

  // Fetch the count of recently changed symptoms
  useEffect(() => {
    if (!currentSurgeryId) return

    const fetchChangesCount = async () => {
      try {
        const response = await fetch(
          `/api/symptoms/changes?surgeryId=${currentSurgeryId}&countOnly=true`,
          { cache: 'no-store' }
        )
        if (response.ok) {
          const data = await response.json()
          setChangesCount(data.count ?? 0)
        }
      } catch (error) {
        console.error('Failed to fetch changes count:', error)
      }
    }

    fetchChangesCount()
  }, [currentSurgeryId])

  if (activeLayout === 'classic') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        {/* Search & age group card */}
        <div className="bg-gray-50 rounded-lg px-4 py-3 mb-3">
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

            {/* count and What's changed link, right aligned */}
            <div className="flex items-center shrink-0">
              <span className="text-sm text-nhs-grey" aria-live="polite">
                {resultsCount} of {totalCount}
                {selectedLetter !== 'All' && ` (${selectedLetter})`}
              </span>
              {currentSurgeryId && (
                <>
                  <span className="mx-2.5 text-gray-300" aria-hidden="true">•</span>
                  <Link
                    href={`/s/${currentSurgeryId}/signposting/changes`}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-md transition-colors ${
                      changesCount && changesCount > 0
                        ? 'font-medium text-nhs-blue hover:bg-blue-50 hover:underline'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    What&apos;s changed
                    {changesCount !== null && changesCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-medium bg-blue-100 text-blue-900 rounded-full">
                        {changesCount}
                      </span>
                    )}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* High-risk buttons */}
        <div className="mt-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 pb-2 min-w-max">
            <HighRiskButtons
              surgeryId={currentSurgeryId}
              variant="classic"
              appearance={highRiskStyle ?? 'pill'}
            />
          </div>
        </div>

        {commonReasonsItems && commonReasonsItems.length > 0 && (
          <CommonReasonsRow items={commonReasonsItems} surgeryId={currentSurgeryId} />
        )}

        {/* Alphabet filter */}
        <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 min-w-max">
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
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
      <div className="lg:flex lg:items-start lg:gap-6">
        <div className="flex-1">
          <div className="max-w-2xl w-full mx-auto lg:mx-0">
            {/* Search card */}
            <div className="bg-gray-50 rounded-lg px-4 py-3">
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
                <div className="flex items-center shrink-0">
                  <span className="text-sm text-nhs-grey" aria-live="polite">
                    {resultsCount} of {totalCount}
                    {selectedLetter !== 'All' && ` (${selectedLetter})`}
                  </span>
                  {currentSurgeryId && (
                    <>
                      <span className="mx-2.5 text-gray-300" aria-hidden="true">•</span>
                      <Link
                        href={`/s/${currentSurgeryId}/signposting/changes`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-md transition-colors ${
                          changesCount && changesCount > 0
                            ? 'font-medium text-nhs-blue hover:bg-blue-50 hover:underline'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        What&apos;s changed
                        {changesCount !== null && changesCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-medium bg-blue-100 text-blue-900 rounded-full">
                            {changesCount}
                          </span>
                        )}
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Age + Alphabet filters card */}
            <div className="mt-3 bg-gray-50 rounded-lg px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
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
            </div>

            {commonReasonsItems && commonReasonsItems.length > 0 && (
              <CommonReasonsRow items={commonReasonsItems} surgeryId={currentSurgeryId} />
            )}
          </div>
        </div>

        <aside className="lg:w-80 w-full lg:shrink-0 lg:mt-2 mt-6">
          <HighRiskButtons
            surgeryId={currentSurgeryId}
            variant="split"
            appearance={highRiskStyle ?? 'pill'}
          />
        </aside>
      </div>
    </div>
  )
}

