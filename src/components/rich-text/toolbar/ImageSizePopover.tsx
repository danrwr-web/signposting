'use client'

import type { Editor } from '@tiptap/react'
import ToolbarButton from '@/components/rich-text/toolbar/ToolbarButton'
import { useToolbarPopover } from '@/components/rich-text/toolbar/useToolbarPopover'
import { IMAGE_SIZE_PRESETS } from '@/components/rich-text/extensions'

interface ImageSizePopoverProps {
  editor: Editor
  /** Width of the currently selected image, null = natural size. */
  activeWidth: number | null
  /** Disabled (greyed) when no image is selected. */
  disabled: boolean
  children: React.ReactNode
}

/**
 * Size presets for the currently selected inline image. Sits next to the
 * image-upload button and is only actionable while an image node is selected.
 */
export default function ImageSizePopover({ editor, activeWidth, disabled, children }: ImageSizePopoverProps) {
  const { open, toggle, close, containerRef, triggerRef } = useToolbarPopover()

  const applyWidth = (width: number | null) => {
    editor.chain().focus().updateAttributes('image', { width }).run()
    close()
  }

  return (
    <div className="relative" ref={containerRef}>
      <ToolbarButton
        ref={triggerRef}
        onClick={toggle}
        label="Image size"
        active={open}
        disabled={disabled}
        expanded={open}
        hasPopup
      >
        {children}
      </ToolbarButton>
      {open && !disabled && (
        <div
          role="menu"
          aria-label="Image size"
          className="absolute left-0 top-full z-20 mt-1 w-36 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {IMAGE_SIZE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              role="menuitemradio"
              aria-checked={activeWidth === preset.width}
              onClick={() => applyWidth(preset.width)}
              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 ${
                activeWidth === preset.width ? 'font-semibold text-nhs-blue' : 'text-gray-700'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            role="menuitemradio"
            aria-checked={activeWidth === null}
            onClick={() => applyWidth(null)}
            className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 ${
              activeWidth === null ? 'font-semibold text-nhs-blue' : 'text-gray-700'
            }`}
          >
            Original size
          </button>
        </div>
      )}
    </div>
  )
}
