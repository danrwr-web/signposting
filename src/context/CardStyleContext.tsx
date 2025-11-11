'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type CardStyle = 'default' | 'powerappsBlue'
export type HeaderLayout = 'classic' | 'split'

interface CardStyleContextValue {
  cardStyle: CardStyle
  setCardStyle: (style: CardStyle) => void
  isSimplified: boolean
  setIsSimplified: (simplified: boolean) => void
  headerLayout: HeaderLayout
  setHeaderLayout: (layout: HeaderLayout) => void
  version: number
}

const CardStyleContext = createContext<CardStyleContextValue | undefined>(undefined)

const STYLE_STORAGE_KEY = 'signposting-card-style-preference'
const SIMPLIFIED_STORAGE_KEY = 'signposting-card-simplified'
const HEADER_LAYOUT_STORAGE_KEY = 'signposting-header-layout'
const LEGACY_STORAGE_KEY = 'signposting-card-style'

interface ProviderProps {
  children: React.ReactNode
}

export function CardStyleProvider({ children }: ProviderProps) {
  const [cardStyle, setCardStyleState] = useState<CardStyle>('default')
  const [isSimplified, setIsSimplifiedState] = useState(false)
  const [headerLayout, setHeaderLayoutState] = useState<HeaderLayout>('split')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    let nextStyle: CardStyle = 'default'
    let nextSimplified = false
    let nextHeaderLayout: HeaderLayout = 'split'

    const storedStyle = localStorage.getItem(STYLE_STORAGE_KEY) as CardStyle | null
    if (storedStyle === 'default' || storedStyle === 'powerappsBlue') {
      nextStyle = storedStyle
    }

    const storedSimplified = localStorage.getItem(SIMPLIFIED_STORAGE_KEY)
    if (storedSimplified === 'true' || storedSimplified === 'false') {
      nextSimplified = storedSimplified === 'true'
    }

    const storedHeaderLayout = localStorage.getItem(HEADER_LAYOUT_STORAGE_KEY) as HeaderLayout | null
    if (storedHeaderLayout === 'classic' || storedHeaderLayout === 'split') {
      nextHeaderLayout = storedHeaderLayout
    }

    // Handle legacy single-value storage for backwards compatibility
    const legacyValue = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!storedStyle && (legacyValue === 'default' || legacyValue === 'powerappsBlue')) {
      nextStyle = legacyValue
    }
    if (!storedSimplified) {
      if (legacyValue === 'simplified') {
        nextSimplified = true
      } else if (legacyValue === 'default' || legacyValue === 'powerappsBlue') {
        nextSimplified = false
      }
    }

    setCardStyleState(nextStyle)
    setIsSimplifiedState(nextSimplified)
    setHeaderLayoutState(nextHeaderLayout)
  }, [])

  const setCardStyle = useCallback((style: CardStyle) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STYLE_STORAGE_KEY, style)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
    setCardStyleState(style)
    setVersion(v => v + 1)
  }, [])

  const setIsSimplified = useCallback((simplified: boolean) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SIMPLIFIED_STORAGE_KEY, simplified ? 'true' : 'false')
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
    setIsSimplifiedState(simplified)
    setVersion(v => v + 1)
  }, [])

  const setHeaderLayout = useCallback((layout: HeaderLayout) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(HEADER_LAYOUT_STORAGE_KEY, layout)
    }
    setHeaderLayoutState(layout)
    setVersion(v => v + 1)
  }, [])

  const value = useMemo(() => ({
    cardStyle,
    setCardStyle,
    isSimplified,
    setIsSimplified,
    headerLayout,
    setHeaderLayout,
    version
  }), [cardStyle, setCardStyle, isSimplified, setIsSimplified, headerLayout, setHeaderLayout, version])

  return (
    <CardStyleContext.Provider value={value}>
      {children}
    </CardStyleContext.Provider>
  )
}

export function useCardStyle(): CardStyleContextValue {
  const ctx = useContext(CardStyleContext)
  if (!ctx) {
    return {
      cardStyle: 'default',
      setCardStyle: () => {},
      isSimplified: false,
      setIsSimplified: () => {},
      headerLayout: 'split',
      setHeaderLayout: () => {},
      version: 0
    }
  }
  return ctx
}

