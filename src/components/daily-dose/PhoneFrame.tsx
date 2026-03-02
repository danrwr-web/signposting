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
// On desktop the header is visible (~120px)
const RESERVE_SPACE_DESKTOP = 120

export default function PhoneFrame({ children, actions, className = '', alignActions = true }: PhoneFrameProps) {
  const [scale, setScale] = useState(1)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const calculateScale = () => {
      if (typeof window === 'undefined') return

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const mobile = viewportWidth < 768
      setIsMobile(mobile)

      if (mobile) {
        // On mobile the frame IS the screen — no scaling needed
        setScale(1)
        return
      }

      const availableWidth = viewportWidth * 0.9
      const availableHeight = viewportHeight - RESERVE_SPACE_DESKTOP

      const scaleByWidth = availableWidth / BASE_WIDTH
      const scaleByHeight = availableHeight / BASE_HEIGHT

      const newScale = Math.min(scaleByWidth, scaleByHeight, 1)
      setScale(Math.max(0.3, newScale))
    }

    calculateScale()
    window.addEventListener('resize', calculateScale)
    return () => window.removeEventListener('resize', calculateScale)
  }, [])

  const scaledWidth = BASE_WIDTH * scale

  // On mobile: true full-screen — fixed, no border, no rounded corners, no padding
  if (isMobile) {
    return (
      <>
        <div className="fixed inset-0 z-10 overflow-hidden bg-white">
          <div className="h-full overflow-y-auto">{children}</div>
        </div>
        {actions ? (
          <div className="fixed bottom-0 left-0 right-0 z-20 flex flex-wrap justify-center gap-2 bg-white p-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
            {actions}
          </div>
        ) : null}
      </>
    )
  }

  // On desktop: the decorative phone shell with scaling
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
