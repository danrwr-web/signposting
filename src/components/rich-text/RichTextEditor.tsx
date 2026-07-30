/**
 * Rich text editor for instruction and handbook content.
 *
 * Contract with the rest of the app:
 * - HTML in (`value`), HTML out (`onChange`). `onChange` fires ONLY when the
 *   user edits — never on mount or rehydration. Several features (notably the
 *   AI re-run classifier) compare stored HTML by exact string equality, so a
 *   mount-time re-serialization would corrupt their bookkeeping.
 * - Uncontrolled while typing: content is hydrated once, then re-hydrated only
 *   when `docId` changes (switching documents/items).
 * - Everything the editor can produce must survive `sanitizeHtml()` — see
 *   `extensions.ts` for the schema.
 */
'use client'

import { useEffect, useMemo, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { createRichTextExtensions } from '@/components/rich-text/extensions'
import { cleanPastedHtml, normalizeHtml } from '@/components/rich-text/normalizeHtml'
import { sanitizeAdminToolkitHtml, sanitizeHtml } from '@/lib/sanitizeHtml'
import { Skeleton } from '@/components/ui'
import Toolbar from '@/components/rich-text/toolbar/Toolbar'
import type { ImageUploadTarget } from '@/components/rich-text/toolbar/ImagePopover'

interface RichTextEditorProps {
  /**
   * Required to prevent selection resets when switching between documents/items.
   * If you do not provide this, the editor will treat the content as a single document for its lifetime.
   */
  docId?: string
  value: string
  onChange: (html: string) => void
  className?: string
  readOnly?: boolean
  placeholder?: string
  height?: number
  /**
   * Enables inline images (Practice Handbook content only): adds the image
   * node to the schema, an upload button to the toolbar, and switches the
   * paste sanitizer to the handbook variant so internal images survive.
   * Content edited with this set must be saved via `sanitizeAdminToolkitHtml`.
   */
  imageUpload?: ImageUploadTarget
  'data-testid'?: string
}

export default function RichTextEditor({
  docId = 'rich-text-editor',
  value,
  onChange,
  className = '',
  readOnly = false,
  placeholder = 'Start typing...',
  height = 300,
  imageUpload,
  'data-testid': testId,
}: RichTextEditorProps) {
  const lastDocIdRef = useRef<string>(docId)

  const enableImages = !!imageUpload
  const extensions = useMemo(
    () => createRichTextExtensions({ placeholder, enableImages }),
    [placeholder, enableImages],
  )
  const sanitize = enableImages ? sanitizeAdminToolkitHtml : sanitizeHtml

  const editor = useEditor({
    // Defer creation to the client so server and first client render match —
    // no hydration mismatch, no mounted-state workarounds.
    immediatelyRender: false,
    extensions,
    content: normalizeHtml(value),
    editable: !readOnly,
    editorProps: {
      transformPastedHTML: (html) => sanitize(cleanPastedHtml(html)),
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML())
    },
  })

  // Re-hydrate only when switching documents/items.
  useEffect(() => {
    if (!editor) return
    if (lastDocIdRef.current === docId) return

    lastDocIdRef.current = docId
    const nextHtml = normalizeHtml(value)
    if (editor.getHTML() === nextHtml) return

    // Never emit an update: rehydration is not a user edit.
    editor.commands.setContent(nextHtml, { emitUpdate: false })
  }, [editor, docId, value])

  // Keep editability in sync if readOnly changes after mount.
  useEffect(() => {
    if (editor && editor.isEditable !== !readOnly) {
      editor.setEditable(!readOnly)
    }
  }, [editor, readOnly])

  if (!editor) {
    return (
      <div className={className}>
        <Skeleton width="w-full" rounded="md" style={{ height: height + (readOnly ? 0 : 44) }} />
      </div>
    )
  }

  return (
    <div className={`rich-text-editor ${className}`} data-testid={testId}>
      {!readOnly && <Toolbar editor={editor} imageUpload={imageUpload} />}
      <div
        className={`border border-gray-300 bg-white ${
          readOnly ? 'rounded-md' : 'rounded-b-md'
        } focus-within:ring-2 focus-within:ring-nhs-blue focus-within:ring-offset-1`}
        style={{ height }}
      >
        <EditorContent editor={editor} className="h-full overflow-y-auto p-3" aria-label={placeholder} />
      </div>
    </div>
  )
}
