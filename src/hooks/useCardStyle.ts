'use client'

import { useState, useEffect } from 'react'

export type CardStyle = 'default' | 'powerappsBlue'

const STORAGE_KEY = 'signposting-card-style'

export function useCardStyle() {
  const [cardStyle, setCardStyleState] = useState<CardStyle>('default')

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) as CardStyle | null
      if (saved === 'default' || saved === 'powerappsBlue') {
        setCardStyleState(saved)
      }
    }
  }, [])

  // Update state and localStorage when style changes
  const setCardStyle = (style: CardStyle) => {
    setCardStyleState(style)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, style)
    }
  }

  return { cardStyle, setCardStyle }
}

