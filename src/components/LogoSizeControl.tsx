'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

const LOCAL_STORAGE_KEY = 'logoHeightPx'

export default function LogoSizeControl() {
  const searchParams = useSearchParams()
  const show = useMemo(() => searchParams?.get('logoSize') === '1', [searchParams])
  const [height, setHeight] = useState<number>(32)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(LOCAL_STORAGE_KEY) : null
      const parsed = stored ? parseInt(stored, 10) : NaN
      if (!Number.isNaN(parsed) && parsed >= 16 && parsed <= 96) {
        setHeight(parsed)
        document.documentElement.style.setProperty('--logo-height', `${parsed}px`)
      }
    } catch {
      // ignore storage errors
    }
  }, [])

  // Apply and persist on change
  const handleChange = (value: number) => {
    setHeight(value)
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, String(value))
      }
    } catch {
      // ignore storage errors
    }
    document.documentElement.style.setProperty('--logo-height', `${value}px`)
  }

  if (!show) return null

  return (
    <div className="ml-3 flex items-center gap-2" aria-live="polite">
      <label htmlFor="logo-size" className="sr-only">Logo size</label>
      <input
        id="logo-size"
        type="range"
        min={20}
        max={64}
        step={2}
        value={height}
        onChange={(e) => handleChange(parseInt(e.target.value, 10))}
        className="w-28 accent-nhs-blue"
        aria-valuemin={20}
        aria-valuemax={64}
        aria-valuenow={height}
        aria-label="Logo size"
      />
      <span className="text-xs text-nhs-grey tabular-nums" aria-hidden="true">{height}px</span>
    </div>
  )
}


