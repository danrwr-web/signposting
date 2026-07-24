'use client'

import { useState, useRef, useEffect, useId, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { Input } from '@/components/ui'
import { debounce } from '@/lib/debounce'
import type { OdsSearchResult, PracticeLookupDetail } from './types'

const MIN_QUERY_LENGTH = 2

interface Props {
  /** Controlled text value (the practice name form field) */
  value: string
  /** Fired as the user types */
  onChange: (text: string) => void
  /** Fired when a practice is picked and its details resolved */
  onSelect: (detail: PracticeLookupDetail) => void
  required?: boolean
  disabled?: boolean
}

export default function PracticeSearchCombobox({
  value,
  onChange,
  onSelect,
  required,
  disabled,
}: Props) {
  const [results, setResults] = useState<OdsSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [searching, setSearching] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const listboxId = useId()

  const runSearch = useCallback(async (query: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setSearching(true)
    setSearchError(null)
    try {
      const res = await fetch(`/api/super/practice-lookup?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setResults([])
        setSearchError(data.error || 'Practice search is unavailable — you can still type manually')
        setOpen(true)
        return
      }
      const data = await res.json()
      setResults(Array.isArray(data.results) ? data.results : [])
      setActiveIndex(-1)
      setOpen(true)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setResults([])
      setSearchError('Practice search is unavailable — you can still type manually')
      setOpen(true)
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }, [])

  const debouncedSearch = useRef(debounce((query: string) => void runSearch(query), 300))

  useEffect(() => {
    const debounced = debouncedSearch.current
    return () => {
      debounced.cancel()
      abortRef.current?.abort()
    }
  }, [])

  // Close on click outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  function handleInputChange(text: string) {
    onChange(text)
    const query = text.trim()
    if (query.length < MIN_QUERY_LENGTH) {
      debouncedSearch.current.cancel()
      abortRef.current?.abort()
      setResults([])
      setOpen(false)
      setSearching(false)
      setSearchError(null)
      return
    }
    debouncedSearch.current(query)
  }

  async function selectResult(result: OdsSearchResult) {
    setOpen(false)
    setResolving(true)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch(`/api/super/practice-lookup/${encodeURIComponent(result.odsCode)}`, {
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Could not load practice details — name filled in only')
        onChange(result.name)
        return
      }
      const detail: PracticeLookupDetail = await res.json()
      onChange(detail.name)
      onSelect(detail)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      toast.error('Could not load practice details — name filled in only')
      onChange(result.name)
    } finally {
      if (!controller.signal.aborted) setResolving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open && results.length > 0) {
        setOpen(true)
        setActiveIndex(0)
      } else if (open) {
        setActiveIndex((i) => Math.min(i + 1, results.length - 1))
      }
    } else if (e.key === 'ArrowUp') {
      if (open) {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      }
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault()
        void selectResult(results[activeIndex])
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.stopPropagation()
        setOpen(false)
      }
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const optionId = (index: number) => `${listboxId}-option-${index}`

  return (
    <div ref={containerRef} className="relative">
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        autoComplete="off"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Start typing to search the NHS register…"
        required={required}
        disabled={disabled || resolving}
      />
      {resolving && (
        <p className="mt-1 text-xs text-gray-500">Loading practice details…</p>
      )}
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Matching GP practices"
          className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
        >
          {searching && (
            <li className="px-3 py-2 text-sm text-gray-500">Searching NHS register…</li>
          )}
          {!searching && searchError && (
            <li className="px-3 py-2 text-sm text-amber-700">{searchError}</li>
          )}
          {!searching && !searchError && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">
              No matching practices — you can still type the name manually
            </li>
          )}
          {!searching &&
            results.map((result, index) => (
              <li
                key={result.odsCode}
                id={optionId(index)}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void selectResult(result)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`px-3 py-2 cursor-pointer text-sm ${
                  index === activeIndex ? 'bg-nhs-blue text-white' : 'text-gray-900'
                }`}
              >
                <span className="block font-medium">{result.name}</span>
                <span
                  className={`block text-xs ${
                    index === activeIndex ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {result.odsCode}
                  {result.postcode ? ` · ${result.postcode}` : ''}
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
