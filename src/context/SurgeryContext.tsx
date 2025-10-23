'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'

export interface SurgeryState {
  id: string
  slug: string
  name: string
}

interface SurgeryContextValue {
  surgery: SurgeryState | null
  currentSurgeryId: string | null
  currentSurgerySlug: string | null
  setSurgery: (next: SurgeryState) => void
  clearSurgery: () => void
  availableSurgeries: SurgeryState[]
  canManageSurgery: (surgeryId: string) => boolean
  isSuperuser: boolean
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
  availableSurgeries: SurgeryState[]
  children: React.ReactNode
}

export function SurgeryProvider({ initialSurgery, availableSurgeries, children }: ProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [surgery, setSurgeryState] = useState<SurgeryState | null>(initialSurgery)
  const isSettingRef = useRef(false)

  // Get user info from session
  const user = session?.user as any
  const isSuperuser = user?.globalRole === 'SUPERUSER'
  const memberships = user?.memberships || []

  // On mount: apply precedence URL > cookie > localStorage > user's default surgery
  useEffect(() => {
    // Guard against re-entrancy
    if (isSettingRef.current) return

    const urlId = searchParams.get('surgery') || undefined
    if (urlId) {
      // Check if user has access to this surgery
      const hasAccess = isSuperuser || memberships.some((m: any) => m.surgeryId === urlId)
      if (hasAccess) {
        const surgeryData = availableSurgeries.find(s => s.id === urlId)
        const next: SurgeryState = surgeryData || { id: urlId, slug: urlId, name: '' }
        setSurgeryState(next)
        writeCookie(COOKIE_KEY, urlId, COOKIE_MAX_AGE)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        return
      }
    }

    const cookieId = readCookie(COOKIE_KEY)
    if (cookieId) {
      // Check if user has access to this surgery
      const hasAccess = isSuperuser || memberships.some((m: any) => m.surgeryId === cookieId)
      if (hasAccess) {
        const stored = localStorage.getItem(STORAGE_KEY)
        const parsed: SurgeryState | null = stored ? safeParseJSON(stored) : null
        const surgeryData = availableSurgeries.find(s => s.id === cookieId)
        const next: SurgeryState = parsed && parsed.id === cookieId ? parsed : surgeryData || { id: cookieId, slug: cookieId, name: '' }
        setSurgeryState(next)
        return
      }
    }

    // Fallback to localStorage if present and user has access
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed: SurgeryState | null = safeParseJSON(stored)
      if (parsed) {
        const hasAccess = isSuperuser || memberships.some((m: any) => m.surgeryId === parsed.id)
        if (hasAccess) {
          setSurgeryState(parsed)
          writeCookie(COOKIE_KEY, parsed.id, COOKIE_MAX_AGE)
          return
        }
      }
    }

    // Final fallback: user's default surgery
    if (user?.defaultSurgeryId) {
      const hasAccess = isSuperuser || memberships.some((m: any) => m.surgeryId === user.defaultSurgeryId)
      if (hasAccess) {
        const surgeryData = availableSurgeries.find(s => s.id === user.defaultSurgeryId)
        if (surgeryData) {
          setSurgeryState(surgeryData)
          writeCookie(COOKIE_KEY, surgeryData.id, COOKIE_MAX_AGE)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(surgeryData))
        }
      }
    }
  }, [user, isSuperuser, memberships, availableSurgeries])

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
    // Check if user has access to this surgery
    const hasAccess = isSuperuser || memberships.some((m: any) => m.surgeryId === next.id)
    if (!hasAccess) {
      console.warn('User does not have access to surgery:', next.id)
      return
    }

    isSettingRef.current = true
    setSurgeryState(next)
    writeCookie(COOKIE_KEY, next.id, COOKIE_MAX_AGE)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))

    // Shallow push ?surgery=<id>
    const params = new URLSearchParams(searchParams.toString())
    params.set('surgery', next.id)
    router.push(`${pathname}?${params.toString()}`)
    isSettingRef.current = false
  }, [pathname, router, searchParams, isSuperuser, memberships])

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

  const canManageSurgery = useCallback((surgeryId: string) => {
    if (isSuperuser) return true
    return memberships.some((m: any) => m.surgeryId === surgeryId && m.role === 'ADMIN')
  }, [isSuperuser, memberships])

  const value = useMemo(() => ({ 
    surgery, 
    currentSurgeryId: surgery?.id ?? null,
    currentSurgerySlug: surgery?.slug ?? surgery?.id ?? null,
    setSurgery, 
    clearSurgery, 
    availableSurgeries,
    canManageSurgery,
    isSuperuser
  }), [surgery, setSurgery, clearSurgery, availableSurgeries, canManageSurgery, isSuperuser])
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



