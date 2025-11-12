'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type CardStyle = 'default' | 'powerappsBlue'
export type HeaderLayout = 'classic' | 'split'
export type HighRiskStyle = 'pill' | 'tile'

interface CardStyleContextValue {
  cardStyle: CardStyle
  setCardStyle: (style: CardStyle) => void
  isSimplified: boolean
  setIsSimplified: (simplified: boolean) => void
  headerLayout: HeaderLayout
  setHeaderLayout: (layout: HeaderLayout) => void
  highRiskStyleSplit: HighRiskStyle
  setHighRiskStyleSplit: (style: HighRiskStyle) => void
  highRiskStyleClassic: HighRiskStyle
  setHighRiskStyleClassic: (style: HighRiskStyle) => void
  resetPrefs: () => void
  version: number
}

const CardStyleContext = createContext<CardStyleContextValue | undefined>(undefined)

const STYLE_STORAGE_KEY = 'signposting-card-style-preference'
const SIMPLIFIED_STORAGE_KEY = 'signposting-card-simplified'
const HEADER_LAYOUT_STORAGE_KEY = 'signposting-header-layout'
const HIGH_RISK_SPLIT_STYLE_STORAGE_KEY = 'signposting-high-risk-style-split'
const HIGH_RISK_CLASSIC_STYLE_STORAGE_KEY = 'signposting-high-risk-style-classic'
const LEGACY_HIGH_RISK_STYLE_STORAGE_KEY = 'signposting-high-risk-style'
const LEGACY_STORAGE_KEY = 'signposting-card-style'

interface ProviderProps {
  children: React.ReactNode
}

export function CardStyleProvider({ children }: ProviderProps) {
  const [cardStyle, setCardStyleState] = useState<CardStyle>('default')
  const [isSimplified, setIsSimplifiedState] = useState(false)
  const [headerLayout, setHeaderLayoutState] = useState<HeaderLayout>('split')
  const [highRiskStyleSplit, setHighRiskStyleSplitState] = useState<HighRiskStyle>('pill')
  const [highRiskStyleClassic, setHighRiskStyleClassicState] = useState<HighRiskStyle>('pill')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    let nextStyle: CardStyle = 'default'
    let nextSimplified = false
    let nextHeaderLayout: HeaderLayout = 'split'
    let nextHighRiskStyleSplit: HighRiskStyle = 'pill'
    let nextHighRiskStyleClassic: HighRiskStyle = 'pill'

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

    const storedSplitStyle = localStorage.getItem(HIGH_RISK_SPLIT_STYLE_STORAGE_KEY) as HighRiskStyle | null
    if (storedSplitStyle === 'pill' || storedSplitStyle === 'tile') {
      nextHighRiskStyleSplit = storedSplitStyle
    } else {
      const legacySplit = localStorage.getItem(LEGACY_HIGH_RISK_STYLE_STORAGE_KEY) as HighRiskStyle | null
      if (legacySplit === 'pill' || legacySplit === 'tile') {
        nextHighRiskStyleSplit = legacySplit
        localStorage.removeItem(LEGACY_HIGH_RISK_STYLE_STORAGE_KEY)
        localStorage.setItem(HIGH_RISK_SPLIT_STYLE_STORAGE_KEY, legacySplit)
      }
    }

    const storedClassicStyle = localStorage.getItem(HIGH_RISK_CLASSIC_STYLE_STORAGE_KEY) as HighRiskStyle | null
    if (storedClassicStyle === 'pill' || storedClassicStyle === 'tile') {
      nextHighRiskStyleClassic = storedClassicStyle
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
    setHighRiskStyleSplitState(nextHighRiskStyleSplit)
    setHighRiskStyleClassicState(nextHighRiskStyleClassic)
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

  const setHighRiskStyleSplit = useCallback((style: HighRiskStyle) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(HIGH_RISK_SPLIT_STYLE_STORAGE_KEY, style)
    }
    setHighRiskStyleSplitState(style)
    setVersion(v => v + 1)
  }, [])

  const setHighRiskStyleClassic = useCallback((style: HighRiskStyle) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(HIGH_RISK_CLASSIC_STYLE_STORAGE_KEY, style)
    }
    setHighRiskStyleClassicState(style)
    setVersion(v => v + 1)
  }, [])

  const resetPrefs = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STYLE_STORAGE_KEY)
      localStorage.removeItem(SIMPLIFIED_STORAGE_KEY)
      localStorage.removeItem(HEADER_LAYOUT_STORAGE_KEY)
      localStorage.removeItem(HIGH_RISK_SPLIT_STYLE_STORAGE_KEY)
      localStorage.removeItem(HIGH_RISK_CLASSIC_STYLE_STORAGE_KEY)
      localStorage.removeItem(LEGACY_HIGH_RISK_STYLE_STORAGE_KEY)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
    setCardStyleState('default')
    setIsSimplifiedState(false)
    setHeaderLayoutState('split')
    setHighRiskStyleSplitState('pill')
    setHighRiskStyleClassicState('pill')
    setVersion(v => v + 1)
  }, [])

  const value = useMemo(() => ({
    cardStyle,
    setCardStyle,
    isSimplified,
    setIsSimplified,
    headerLayout,
    setHeaderLayout,
    highRiskStyleSplit,
    setHighRiskStyleSplit,
    highRiskStyleClassic,
    setHighRiskStyleClassic,
    resetPrefs,
    version
  }), [
    cardStyle,
    setCardStyle,
    isSimplified,
    setIsSimplified,
    headerLayout,
    setHeaderLayout,
    highRiskStyleSplit,
    setHighRiskStyleSplit,
    highRiskStyleClassic,
    setHighRiskStyleClassic,
    resetPrefs,
    version
  ])

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
      highRiskStyleSplit: 'pill',
      setHighRiskStyleSplit: () => {},
      highRiskStyleClassic: 'pill',
      setHighRiskStyleClassic: () => {},
      resetPrefs: () => {},
      version: 0
    }
  }
  return ctx
}

