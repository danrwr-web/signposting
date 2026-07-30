'use client'

import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Button, Input } from '@/components/ui'
import ToolbarButton from '@/components/rich-text/toolbar/ToolbarButton'
import { useToolbarPopover } from '@/components/rich-text/toolbar/useToolbarPopover'
import { normalizeHref } from '@/components/rich-text/toolbar/linkHref'

interface LinkPopoverProps {
  editor: Editor
  /** Current link href at the selection, if any. */
  activeHref: string | null
  children: React.ReactNode
}

export default function LinkPopover({ editor, activeHref, children }: LinkPopoverProps) {
  const { open, toggle, close, containerRef, triggerRef } = useToolbarPopover()
  const [href, setHref] = useState('')
  const [invalid, setInvalid] = useState(false)

  // Load the selection's current link when the popover opens.
  useEffect(() => {
    if (open) {
      setHref(activeHref ?? '')
      setInvalid(false)
    }
  }, [open, activeHref])

  const apply = () => {
    const normalized = normalizeHref(href)
    if (!normalized) {
      setInvalid(true)
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run()
    close()
  }

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    close()
  }

  return (
    <div className="relative" ref={containerRef}>
      <ToolbarButton ref={triggerRef} onClick={toggle} label="Link" hasPopup expanded={open} active={!!activeHref}>
        {children}
      </ToolbarButton>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
          <label htmlFor="rich-text-link-input" className="mb-1 block text-xs font-medium text-gray-600">
            Link address
          </label>
          <Input
            id="rich-text-link-input"
            value={href}
            error={invalid}
            onChange={(e) => {
              setHref(e.target.value)
              setInvalid(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                apply()
              }
            }}
            placeholder="https://… or name@example.com"
            autoFocus
          />
          {invalid && (
            <p className="mt-1 text-xs text-red-600">Enter a web address (https) or an e-mail address.</p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <Button size="sm" variant="primary" onClick={apply}>
              Apply
            </Button>
            {activeHref && (
              <Button size="sm" variant="ghost" onClick={remove}>
                Remove link
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
