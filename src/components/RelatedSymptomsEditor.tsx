'use client'

/**
 * Repeatable editor for a symptom's related-symptom links. Each link is the
 * name of another symptom (resolved case-insensitively at click time by
 * /api/symptoms/by-name). Suggestions come from the surgery's effective
 * symptom list, but free text is allowed so links can point at symptoms that
 * are renamed or created later.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input } from '@/components/ui'

// Keep in sync with LinkToPagesZ in src/lib/api-contracts.ts.
const MAX_LINKS = 10

interface RelatedSymptomsEditorProps {
  value: string[]
  onChange: (links: string[]) => void
  /** Used to fetch name suggestions; omit for base-symptom (global) editing. */
  surgeryId?: string
  /** Pre-fetched suggestion names; when set, no fetch happens. */
  suggestions?: string[]
  idPrefix?: string
}

export default function RelatedSymptomsEditor({
  value,
  onChange,
  surgeryId,
  suggestions,
  idPrefix = 'related-symptoms',
}: RelatedSymptomsEditorProps) {
  const [draft, setDraft] = useState('')
  const [fetchedNames, setFetchedNames] = useState<string[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const listboxId = `${idPrefix}-listbox`

  useEffect(() => {
    if (suggestions) return
    let cancelled = false
    const url = surgeryId
      ? `/api/symptoms?surgery=${encodeURIComponent(surgeryId)}`
      : '/api/symptoms'
    fetch(url)
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        if (cancelled || !body?.symptoms) return
        const names = Array.from(
          new Set((body.symptoms as Array<{ name?: string }>).map(s => s.name).filter((n): n is string => !!n))
        )
        setFetchedNames(names.sort((a, b) => a.localeCompare(b)))
      })
      .catch(() => {
        // Suggestions are a convenience; free text still works without them.
      })
    return () => {
      cancelled = true
    }
  }, [surgeryId, suggestions])

  const allNames = suggestions ?? fetchedNames

  const filtered = useMemo(() => {
    const q = draft.trim().toLowerCase()
    if (!q) return []
    const chosen = new Set(value.map(v => v.toLowerCase()))
    return allNames
      .filter(n => n.toLowerCase().includes(q) && !chosen.has(n.toLowerCase()))
      .slice(0, 8)
  }, [allNames, draft, value])

  // Close the dropdown when clicking outside it.
  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', onDocMouseDown)
    }
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [dropdownOpen])

  const addLink = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (value.some(v => v.toLowerCase() === trimmed.toLowerCase())) {
      setDraft('')
      setDropdownOpen(false)
      return
    }
    if (value.length >= MAX_LINKS) return
    onChange([...value, trimmed])
    setDraft('')
    setDropdownOpen(false)
  }

  const removeLink = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-2 space-y-1">
          {value.map((link, index) => (
            <li
              key={`${link}-${index}`}
              className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-800"
            >
              <span className="truncate">{link}</span>
              <button
                type="button"
                onClick={() => removeLink(index)}
                className="text-gray-400 hover:text-red-600 shrink-0"
                aria-label={`Remove link to ${link}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length < MAX_LINKS && (
        <div className="relative" ref={dropdownRef}>
          <div className="flex gap-2">
            <Input
              id={`${idPrefix}-input`}
              type="text"
              value={draft}
              onChange={e => {
                setDraft(e.target.value)
                setDropdownOpen(true)
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addLink(draft)
                }
              }}
              placeholder="Search or type a symptom name…"
              role="combobox"
              aria-expanded={dropdownOpen && filtered.length > 0}
              aria-controls={listboxId}
              aria-describedby={`${idPrefix}-help`}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => addLink(draft)}
              disabled={!draft.trim()}
            >
              Add
            </Button>
          </div>
          {dropdownOpen && filtered.length > 0 && (
            <div
              id={listboxId}
              className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto"
              role="listbox"
              aria-label="Matching symptoms"
            >
              {filtered.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => addLink(name)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                  role="option"
                  aria-selected={false}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          <p id={`${idPrefix}-help`} className="text-xs text-gray-500 mt-1">
            Links open the named symptom&apos;s page. Use the exact symptom name; you can add up to {MAX_LINKS}.
          </p>
        </div>
      )}
    </div>
  )
}
