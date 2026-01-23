'use client'

import { createContext, useCallback, useContext, useState, useMemo, ReactNode } from 'react'

interface NavigationPanelContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const NavigationPanelContext = createContext<NavigationPanelContextValue | undefined>(undefined)

interface NavigationPanelProviderProps {
  children: ReactNode
}

export function NavigationPanelProvider({ children }: NavigationPanelProviderProps) {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])

  const value = useMemo(() => ({
    isOpen,
    open,
    close,
    toggle,
  }), [isOpen, open, close, toggle])

  return (
    <NavigationPanelContext.Provider value={value}>
      {children}
    </NavigationPanelContext.Provider>
  )
}

export function useNavigationPanel(): NavigationPanelContextValue {
  const ctx = useContext(NavigationPanelContext)
  if (!ctx) {
    throw new Error('useNavigationPanel must be used within a NavigationPanelProvider')
  }
  return ctx
}
