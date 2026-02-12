'use client'

import { useEffect, useState } from 'react'

interface PhoneFrameProps {
  children: React.ReactNode
  /** Optional actions to render outside/below the phone (e.g. Approve, Publish) */
  actions?: React.ReactNode
  /** Optional className for the outer wrapper */
  className?: string
  /** When true, actions stretch to max-w-[400px] to align with phone */
  alignActions?: boolean
}

// Base/reference size for the phone frame (maintains aspect ratio when scaled)
const BASE_WIDTH = 400
const BASE_HEIGHT = 711 // 400 * 16/9 ≈ 711 (9:16 aspect ratio)
const RESERVE_SPACE = 250 // Space reserved for header, actions, padding

export default function PhoneFrame({ children, actions, className = '', alignActions = true }: PhoneFrameProps) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const calculateScale = () => {
      if (typeof window === 'undefined') return

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const availableWidth = viewportWidth * 0.9 // 90% of viewport width
      const availableHeight = viewportHeight - RESERVE_SPACE

      // Calculate scale factors based on width and height constraints
      const scaleByWidth = availableWidth / BASE_WIDTH
      const scaleByHeight = availableHeight / BASE_HEIGHT

      // Use the smaller scale to ensure it fits both dimensions
      const newScale = Math.min(scaleByWidth, scaleByHeight, 1) // Never scale up beyond 1x
      setScale(Math.max(0.3, newScale)) // Minimum scale of 0.3x to prevent it being too tiny
    }

    calculateScale()
    window.addEventListener('resize', calculateScale)
    return () => window.removeEventListener('resize', calculateScale)
  }, [])

  const scaledWidth = BASE_WIDTH * scale
  const scaledHeight = BASE_HEIGHT * scale

  return (
    <div className={`flex flex-col items-center gap-4 p-4 ${className}`}>
      <div
        className="relative overflow-hidden rounded-[2.5rem] border-[14px] border-slate-800 bg-slate-800 shadow-2xl"
        style={{
          width: `${BASE_WIDTH}px`,
          height: `${BASE_HEIGHT}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        <div className="h-full overflow-hidden bg-white">{children}</div>
      </div>
      {actions ? (
        <div
          className={`flex flex-wrap justify-center gap-2 ${alignActions ? 'w-full' : ''}`}
          style={alignActions ? { maxWidth: `${scaledWidth}px` } : undefined}
        >
          {actions}
        </div>
      ) : null}
    </div>
  )
}
