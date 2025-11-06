'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type CardStyle = 'default' | 'powerappsBlue'

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

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) as CardStyle | null
      if (saved === 'default' || saved === 'powerappsBlue') {
        setCardStyleState(saved)
      }
      setIsHydrated(true)
    }
  }, [])

  // Update state and localStorage when style changes
  const setCardStyle = useCallback((style: CardStyle) => {
    setCardStyleState((current) => {
      // Always update even if same value to ensure re-render
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, style)
      }
      return style
    })
  }, [])

  const value = useMemo(() => ({
    cardStyle,
    setCardStyle
  }), [cardStyle, setCardStyle])

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

