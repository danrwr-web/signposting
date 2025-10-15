'use client'

import { useState, useEffect, forwardRef } from 'react'

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
}

const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(({ 
  value, 
  onChange, 
  placeholder = "Search symptoms...", 
  debounceMs = 300 
}, ref) => {
  const [localValue, setLocalValue] = useState(value)

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Debounce the onChange call
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue)
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [localValue, onChange, debounceMs, value])

  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 pl-10 border border-nhs-grey rounded-lg focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:border-transparent"
      />
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg className="h-5 w-5 text-nhs-grey" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
    </div>
  )
})

SearchBox.displayName = 'SearchBox'

export default SearchBox
