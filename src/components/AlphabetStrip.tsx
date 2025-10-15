/**
 * A-Z letter filter component for symptoms
 * Provides circular buttons for alphabet navigation
 */

'use client'

import { useState, useEffect } from 'react'

type Letter = 'All' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'

interface AlphabetStripProps {
  selected?: Letter
  onSelect: (letter: Letter) => void
  size?: 'sm' | 'md' | 'lg'
}

const LETTERS: Letter[] = [
  'All', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
]

export default function AlphabetStrip({ selected = 'All', onSelect, size = 'md' }: AlphabetStripProps) {
  const [focusedIndex, setFocusedIndex] = useState(0)

  // Persist selection to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('selectedLetter')
    if (saved && LETTERS.includes(saved as Letter)) {
      onSelect(saved as Letter)
    }
  }, [onSelect])

  // Save selection to localStorage
  useEffect(() => {
    localStorage.setItem('selectedLetter', selected)
  }, [selected])

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg'
  }

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault()
        onSelect(LETTERS[index])
        break
      case 'ArrowLeft':
        event.preventDefault()
        const prevIndex = index > 0 ? index - 1 : LETTERS.length - 1
        setFocusedIndex(prevIndex)
        break
      case 'ArrowRight':
        event.preventDefault()
        const nextIndex = index < LETTERS.length - 1 ? index + 1 : 0
        setFocusedIndex(nextIndex)
        break
    }
  }

  return (
    <div className="flex flex-wrap gap-2 justify-center mb-6">
      {LETTERS.map((letter, index) => {
        const isSelected = letter === selected
        const isFocused = index === focusedIndex
        
        return (
          <button
            key={letter}
            onClick={() => onSelect(letter)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onFocus={() => setFocusedIndex(index)}
            aria-pressed={isSelected}
            aria-label={`Filter by ${letter === 'All' ? 'all symptoms' : `symptoms starting with ${letter}`}`}
            className={`
              ${sizeClasses[size]}
              rounded-full border-2 font-medium transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2
              ${isSelected 
                ? 'bg-nhs-blue text-white border-nhs-blue shadow-md' 
                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:border-gray-400'
              }
              ${isFocused && !isSelected ? 'ring-2 ring-nhs-blue ring-offset-2' : ''}
            `}
          >
            {letter}
          </button>
        )
      })}
    </div>
  )
}
