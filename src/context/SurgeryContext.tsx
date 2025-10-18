'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export interface SurgeryState {
  id: string
  name: string
}

interface SurgeryContextValue {
  surgery: SurgeryState | null
  setSurgery: (next: SurgeryState) => void
  clearSurgery: () => void
}

const SurgeryContext = createContext<SurgeryContextValue | undefined>(undefined)

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[2]) : null
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`
}

function removeCookie(name: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
}

const COOKIE_KEY = 'surgery'
const STORAGE_KEY = 'surgery_state'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180 // 180 days

interface ProviderProps {
  initialSurgery: SurgeryState | null
  children: React.ReactNode
}

export function SurgeryProvider({ initialSurgery, children }: ProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [surgery, setSurgeryState] = useState<SurgeryState | null>(initialSurgery)
  const isSettingRef = useRef(false)

  // On mount: apply precedence URL > cookie > localStorage
  useEffect(() => {
    // Guard against re-entrancy
    if (isSettingRef.current) return

    const urlId = searchParams.get('surgery') || undefined
    if (urlId) {
      // We only know the id from URL here; preserve name from initial state if it matches
      const next: SurgeryState = { id: urlId, name: initialSurgery?.id === urlId ? initialSurgery.name : '' }
      setSurgeryState(next)
      writeCookie(COOKIE_KEY, urlId, COOKIE_MAX_AGE)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return
    }

    const cookieId = readCookie(COOKIE_KEY)
    if (cookieId) {
      const stored = localStorage.getItem(STORAGE_KEY)
      const parsed: SurgeryState | null = stored ? safeParseJSON(stored) : null
      const next: SurgeryState = parsed && parsed.id === cookieId ? parsed : { id: cookieId, name: parsed?.name || '' }
      setSurgeryState(next)
      // Preserve URL without surgery param if not set
      return
    }

    // Fallback to localStorage if present
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed: SurgeryState | null = safeParseJSON(stored)
      if (parsed) {
        setSurgeryState(parsed)
        writeCookie(COOKIE_KEY, parsed.id, COOKIE_MAX_AGE)
      }
    }
  }, [])

  // Cross-tab sync via storage event
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const parsed: SurgeryState | null = e.newValue ? safeParseJSON(e.newValue) : null
      setSurgeryState(parsed)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const setSurgery = useCallback((next: SurgeryState) => {
    isSettingRef.current = true
    setSurgeryState(next)
    writeCookie(COOKIE_KEY, next.id, COOKIE_MAX_AGE)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))

    // Shallow push ?surgery=<id>
    const params = new URLSearchParams(searchParams.toString())
    params.set('surgery', next.id)
    router.push(`${pathname}?${params.toString()}`)
    isSettingRef.current = false
  }, [pathname, router, searchParams])

  const clearSurgery = useCallback(() => {
    isSettingRef.current = true
    setSurgeryState(null)
    removeCookie(COOKIE_KEY)
    localStorage.removeItem(STORAGE_KEY)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('surgery')
    const url = params.toString() ? `${pathname}?${params.toString()}` : pathname
    router.push(url)
    isSettingRef.current = false
  }, [pathname, router, searchParams])

  const value = useMemo(() => ({ surgery, setSurgery, clearSurgery }), [surgery, setSurgery, clearSurgery])
  return (
    <SurgeryContext.Provider value={value}>{children}</SurgeryContext.Provider>
  )
}

export function useSurgery(): SurgeryContextValue {
  const ctx = useContext(SurgeryContext)
  if (!ctx) throw new Error('useSurgery must be used within a SurgeryProvider')
  return ctx
}

function safeParseJSON<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}



