'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Popover behaviour shared by the toolbar's colour, highlight and link
 * popovers: closes on outside click and Escape, and returns focus to the
 * trigger button when closed via keyboard.
 */
export function useToolbarPopover() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const close = useCallback((options?: { returnFocus?: boolean }) => {
    setOpen(false)
    if (options?.returnFocus) {
      triggerRef.current?.focus()
    }
  }, [])

  const toggle = useCallback(() => setOpen((prev) => !prev), [])

  useEffect(() => {
    if (!open) return

    const handleMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close({ returnFocus: true })
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, close])

  return { open, toggle, close, containerRef, triggerRef }
}
