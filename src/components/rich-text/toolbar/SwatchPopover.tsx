'use client'

import type { ReactNode } from 'react'
import ToolbarButton from '@/components/rich-text/toolbar/ToolbarButton'
import { useToolbarPopover } from '@/components/rich-text/toolbar/useToolbarPopover'

interface Swatch {
  readonly name: string
  readonly value: string
}

interface SwatchPopoverProps {
  label: string
  swatches: readonly Swatch[]
  /** Currently applied colour, used to ring the active swatch. */
  activeColor: string | null
  onPick: (color: string) => void
  onClear: () => void
  clearLabel: string
  children: ReactNode
}

export default function SwatchPopover({
  label,
  swatches,
  activeColor,
  onPick,
  onClear,
  clearLabel,
  children,
}: SwatchPopoverProps) {
  const { open, toggle, close, containerRef, triggerRef } = useToolbarPopover()

  return (
    <div className="relative" ref={containerRef}>
      <ToolbarButton ref={triggerRef} onClick={toggle} label={label} hasPopup expanded={open} active={!!activeColor}>
        {children}
      </ToolbarButton>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[176px] rounded-md border border-gray-200 bg-white p-3 shadow-lg">
          <div className="mb-2 text-xs font-medium text-gray-600">{label}</div>
          <div className="grid grid-cols-4 gap-2">
            {swatches.map((swatch) => (
              <button
                key={swatch.value}
                type="button"
                onClick={() => {
                  onPick(swatch.value)
                  close({ returnFocus: true })
                }}
                className={`h-8 w-8 rounded border transition-shadow hover:ring-2 hover:ring-nhs-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
                  activeColor?.toLowerCase() === swatch.value.toLowerCase()
                    ? 'ring-2 ring-nhs-blue ring-offset-1'
                    : ''
                }`}
                style={{
                  backgroundColor: swatch.value,
                  borderColor: swatch.value === '#000000' ? '#e5e7eb' : swatch.value,
                }}
                title={swatch.name}
                aria-label={swatch.name}
              />
            ))}
          </div>
          <div className="mt-2 border-t border-gray-200 pt-2">
            <button
              type="button"
              onClick={() => {
                onClear()
                close({ returnFocus: true })
              }}
              className="text-xs text-gray-600 underline hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-nhs-blue"
            >
              {clearLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
