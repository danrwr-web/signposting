'use client'

import { forwardRef, type ReactNode, type MouseEventHandler } from 'react'

interface ToolbarButtonProps {
  onClick: MouseEventHandler<HTMLButtonElement>
  label: string
  active?: boolean
  disabled?: boolean
  /** Set for popover trigger buttons. */
  expanded?: boolean
  hasPopup?: boolean
  children: ReactNode
}

const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(function ToolbarButton(
  { onClick, label, active = false, disabled = false, expanded, hasPopup, children },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={hasPopup ? undefined : active}
      aria-expanded={hasPopup ? expanded : undefined}
      aria-haspopup={hasPopup ? 'true' : undefined}
      className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded px-1.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-1 disabled:opacity-40 disabled:hover:bg-transparent ${
        active ? 'bg-nhs-blue text-white' : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
})

export default ToolbarButton

export function ToolbarSeparator() {
  return <div role="separator" aria-orientation="vertical" className="mx-1 h-6 w-px self-center bg-gray-300" />
}
