'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type CardStyle = 'default' | 'powerappsBlue' | 'simplified'

interface CardStyleContextValue {
  cardStyle: CardStyle
  setCardStyle: (style: CardStyle) => void
}

const CardStyleContext = createContext<CardStyleContextValue | undefined>(undefined)

const STORAGE_KEY = 'signposting-card-style'

interface ProviderProps {
  children: React.ReactNode
}

export function CardStyleProvider({ children }: ProviderProps) {
  const [cardStyle, setCardStyleState] = useState<CardStyle>('default')
  const [isHydrated, setIsHydrated] = useState(false)
  const [version, setVersion] = useState(0)

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) as CardStyle | null
      if (saved === 'default' || saved === 'powerappsBlue' || saved === 'simplified') {
        setCardStyleState(saved)
      }
      setIsHydrated(true)
    }
  }, [])

  // Update state and localStorage when style changes
  const setCardStyle = useCallback((style: CardStyle) => {
    // Update localStorage first
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, style)
    }
    // Update state - React will detect this change and re-render all consumers
    setCardStyleState(style)
    // Force a version bump to ensure re-render
    setVersion(v => v + 1)
  }, [])

  const value = useMemo(() => ({
    cardStyle,
    setCardStyle,
    version // Include version to force new object reference
  }), [cardStyle, setCardStyle, version])

  return (
    <CardStyleContext.Provider value={value}>
      {children}
    </CardStyleContext.Provider>
  )
}

export function useCardStyle(): CardStyleContextValue {
  const ctx = useContext(CardStyleContext)
  if (!ctx) {
    // Fallback for components outside provider (shouldn't happen, but graceful degradation)
    return {
      cardStyle: 'default',
      setCardStyle: () => {}
    }
  }
  return ctx
}

