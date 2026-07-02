'use client'

import { useMemo } from 'react'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'

export type Letter = 'All' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'

export const LETTERS: Letter[] = [
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

interface LetterPillsProps {
  selectedLetter: Letter
  onLetterChange: (letter: Letter) => void
  /**
   * Symptom list used to grey out letters with no symptoms. Callers should
   * pass the list filtered by the active age band (but not by text search,
   * so pills don't flicker while typing).
   */
  symptoms?: EffectiveSymptom[]
  /** Size classes that differ between layouts, e.g. 'h-9 min-w-9 px-0' (row) or 'h-9 w-9' (grid) */
  pillSizeClasses: string
}

/**
 * The A-Z (+ All) filter pills. Letters with no symptoms are disabled and
 * greyed out; the selected pill is never disabled, and nothing is disabled
 * while the symptom list hasn't loaded yet.
 */
export default function LetterPills({
  selectedLetter,
  onLetterChange,
  symptoms,
  pillSizeClasses,
}: LetterPillsProps) {
  // Letters that have at least one symptom in the provided list.
  const availableLetters = useMemo(() => {
    const set = new Set<string>()
    for (const symptom of symptoms ?? []) {
      const first = symptom.name.trim().charAt(0).toUpperCase()
      if (first >= 'A' && first <= 'Z') set.add(first)
    }
    return set
  }, [symptoms])
  const hasSymptomData = (symptoms?.length ?? 0) > 0

  return (
    <>
      {LETTERS.map((letter) => {
        const isSelected = selectedLetter === letter
        // While symptoms are still loading, leave every pill enabled.
        // Never disable the selected pill so the user can always change it.
        const isAvailable = letter === 'All' || !hasSymptomData || availableLetters.has(letter)
        const isDisabled = !isAvailable && !isSelected

        return (
          <button
            key={letter}
            type="button"
            onClick={() => onLetterChange(letter)}
            disabled={isDisabled}
            className={[
              `${pillSizeClasses} rounded-full border text-sm flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2`,
              isSelected
                ? 'bg-nhs-blue text-white border-nhs-blue'
                : isDisabled
                  ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400',
            ].join(' ')}
            aria-pressed={isSelected}
          >
            {letter}
          </button>
        )
      })}
    </>
  )
}
