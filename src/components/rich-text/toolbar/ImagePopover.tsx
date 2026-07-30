'use client'

import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Button, Input } from '@/components/ui'
import ToolbarButton from '@/components/rich-text/toolbar/ToolbarButton'
import { useToolbarPopover } from '@/components/rich-text/toolbar/useToolbarPopover'

export interface ImageUploadTarget {
  surgeryId: string
  /** Absent when editing a not-yet-created item (admin create form). */
  itemId?: string
}

interface ImagePopoverProps {
  editor: Editor
  imageUpload: ImageUploadTarget
  children: React.ReactNode
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024 // Keep in sync with the upload route.

export default function ImagePopover({ editor, imageUpload, children }: ImagePopoverProps) {
  const { open, toggle, close, containerRef, triggerRef } = useToolbarPopover()
  const [file, setFile] = useState<File | null>(null)
  const [alt, setAlt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setFile(null)
      setAlt('')
      setError(null)
      setUploading(false)
    }
  }, [open])

  const onPickFile = (picked: File | null) => {
    setError(null)
    if (!picked) {
      setFile(null)
      return
    }
    if (picked.type !== 'image/jpeg' && picked.type !== 'image/png') {
      setFile(null)
      setError('Only JPG and PNG images are supported.')
      return
    }
    if (picked.size > MAX_IMAGE_BYTES) {
      setFile(null)
      setError('Image must be 2MB or smaller.')
      return
    }
    setFile(picked)
  }

  const insert = async () => {
    if (!file || uploading) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('surgeryId', imageUpload.surgeryId)
      if (imageUpload.itemId) {
        formData.append('itemId', imageUpload.itemId)
      }
      const res = await fetch('/api/admin-toolkit/images', { method: 'POST', body: formData })
      const body = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok || !body?.url) {
        setError(body?.error || 'Failed to upload image. Please try again.')
        return
      }
      editor.chain().focus().setImage({ src: body.url, alt: alt.trim() }).run()
      close()
    } catch {
      setError('Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <ToolbarButton ref={triggerRef} onClick={toggle} label="Insert image" hasPopup expanded={open}>
        {children}
      </ToolbarButton>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
          <label htmlFor="rich-text-image-file" className="mb-1 block text-xs font-medium text-gray-600">
            Image file (JPG or PNG, max 2MB)
          </label>
          <input
            id="rich-text-image-file"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-gray-700 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
          <label htmlFor="rich-text-image-alt" className="mb-1 mt-3 block text-xs font-medium text-gray-600">
            Alt text (optional)
          </label>
          <Input
            id="rich-text-image-alt"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void insert()
              }
            }}
            placeholder="Describe the image"
          />
          <p className="mt-1 text-xs text-gray-500">
            Describe the image for screen readers; leave blank if decorative.
          </p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <div className="mt-2">
            <Button size="sm" variant="primary" onClick={() => void insert()} disabled={!file} loading={uploading}>
              Insert image
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
