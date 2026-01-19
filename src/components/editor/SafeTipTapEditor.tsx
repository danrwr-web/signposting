/**
 * Safe TipTap editor wrapper.
 *
 * Goals:
 * - Uncontrolled while typing (never setContent on each keystroke)
 * - Only re-hydrate content when `docId` changes (switching documents/items)
 * - Provide consistent caret/selection/focus styling via the `.safe-tiptap` class
 */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { debounce } from '@/lib/debounce'

// NHS colour palette
const NHS_COLORS = [
  { name: 'NHS Blue', value: '#005EB8' },
  { name: 'NHS Red', value: '#DA020E' },
  { name: 'NHS Orange', value: '#F59E0B' },
  { name: 'NHS Green', value: '#00A499' },
  { name: 'Purple', value: '#6A0DAD' },
  { name: 'Pink', value: '#E5007E' },
  { name: 'Black', value: '#000000' },
] as const

function ensureProperParagraphs(content: string): string {
  if (!content || typeof content !== 'string') return ''

  // If content already has proper HTML structure, return as-is.
  if (content.includes('<p>') && content.includes('</p>')) return content

  // If content has line breaks, convert them to paragraphs.
  if (content.includes('\n')) {
    const paragraphs = content
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => `<p>${p}</p>`)
      .join('')
    return paragraphs || '<p></p>'
  }

  // If content is plain text without line breaks, wrap in paragraph.
  return `<p>${content}</p>`
}

export interface SafeTipTapEditorProps {
  docId: string
  initialHtml: string
  editable?: boolean
  /**
   * Immediate change callback (fires on every editor update).
   * This is useful for "Save button" flows that rely on local state.
   */
  onChange?: (html: string) => void
  /**
   * Debounced change callback (intended for autosave or expensive transforms).
   * Default debounce is ~600ms.
   */
  onDebouncedChange?: (html: string) => void
  /**
   * Optional safety net: called on blur (also flushes pending debounce).
   */
  onBlurSave?: (html: string) => void
  className?: string
  placeholder?: string
  height?: number
  'data-testid'?: string
}

export default function SafeTipTapEditor({
  docId,
  initialHtml,
  editable = true,
  onChange,
  onDebouncedChange,
  onBlurSave,
  className = '',
  placeholder = 'Start typing…',
  height = 300,
  'data-testid': testId,
}: SafeTipTapEditorProps) {
  const [mounted, setMounted] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const lastDocIdRef = useRef<string>(docId)

  const debouncedChange = useMemo(() => {
    if (!onDebouncedChange) return null
    return debounce<[string]>(onDebouncedChange, 600)
  }, [onDebouncedChange])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    return () => {
      debouncedChange?.cancel()
    }
  }, [debouncedChange])

  // Close colour picker when clicking outside.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          paragraph: {
            HTMLAttributes: {
              class: 'prose-p',
            },
          },
        }),
        TextStyle,
        Color.configure({
          types: ['textStyle'],
        }),
      ],
      content: ensureProperParagraphs(initialHtml),
      editable,
      onUpdate: ({ editor }) => {
        const html = editor.getHTML()
        onChange?.(html)
        debouncedChange?.(html)
      },
      onBlur: ({ editor }) => {
        const html = editor.getHTML()
        debouncedChange?.flush()
        onBlurSave?.(html)
      },
    },
    [mounted]
  )

  // Only re-hydrate content when switching documents/items.
  useEffect(() => {
    if (!editor) return
    if (lastDocIdRef.current === docId) return

    lastDocIdRef.current = docId
    const nextHtml = ensureProperParagraphs(initialHtml)
    if (editor.getHTML() === nextHtml) return

    // Avoid emitting an update event (prevents feedback loops).
    editor.commands.setContent(nextHtml, { emitUpdate: false })
    // Ensure toolbar state reflects the document.
    setShowColorPicker(false)
  }, [editor, docId, initialHtml])

  if (!mounted || !editor) {
    return (
      <div className={`w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 animate-pulse ${className}`}>
        Loading editor…
      </div>
    )
  }

  return (
    <div className={`safe-tiptap ${className}`} data-testid={testId}>
      {/* Toolbar */}
      {editable && (
        <div className="border border-gray-300 border-b-0 rounded-t-md bg-gray-50 p-2 flex flex-wrap gap-1">
          {/* Bold */}
          <button
            type="button"
            onClick={() => editor.commands.toggleBold()}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
              editor.isActive('bold') ? 'bg-gray-200' : ''
            }`}
            title="Bold"
            aria-pressed={editor.isActive('bold')}
          >
            <span className="font-bold">B</span>
          </button>

          {/* Italic */}
          <button
            type="button"
            onClick={() => editor.commands.toggleItalic()}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
              editor.isActive('italic') ? 'bg-gray-200' : ''
            }`}
            title="Italic"
            aria-pressed={editor.isActive('italic')}
          >
            <span className="italic">I</span>
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Bullet List */}
          <button
            type="button"
            onClick={() => editor.commands.toggleBulletList()}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
              editor.isActive('bulletList') ? 'bg-gray-200' : ''
            }`}
            title="Bullet list"
            aria-pressed={editor.isActive('bulletList')}
          >
            •
          </button>

          {/* Numbered List */}
          <button
            type="button"
            onClick={() => editor.commands.toggleOrderedList()}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
              editor.isActive('orderedList') ? 'bg-gray-200' : ''
            }`}
            title="Numbered list"
            aria-pressed={editor.isActive('orderedList')}
          >
            1.
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Text Colour */}
          <div className="relative" ref={colorPickerRef}>
            <button
              type="button"
              onClick={() => setShowColorPicker(!showColorPicker)}
              className={`px-2 py-1 text-sm rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
                editor.isActive('textStyle') ? 'bg-gray-200' : ''
              }`}
              title="Text colour"
              aria-expanded={showColorPicker}
              aria-haspopup="true"
            >
              <span
                className="font-bold"
                style={{
                  color: editor.getAttributes('textStyle').color || '#000000',
                }}
              >
                A
              </span>
            </button>
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3 z-10 min-w-[200px]">
                <div className="text-xs font-medium text-gray-600 mb-2">Text colour</div>
                <div className="grid grid-cols-3 gap-2">
                  {NHS_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => {
                        editor.chain().focus().setColor(color.value).run()
                        setShowColorPicker(false)
                      }}
                      className={`w-8 h-8 rounded border-2 hover:ring-2 hover:ring-nhs-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue transition-all ${
                        editor.isActive('textStyle', { color: color.value }) ? 'ring-2 ring-nhs-blue' : ''
                      }`}
                      style={{
                        backgroundColor: color.value,
                        borderColor: color.value === '#000000' ? '#e5e7eb' : color.value,
                      }}
                      title={color.name}
                      aria-label={`Set text colour to ${color.name}`}
                    />
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().unsetColor().run()
                      setShowColorPicker(false)
                    }}
                    className="text-xs text-gray-600 hover:text-gray-800 underline"
                  >
                    Remove colour
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Undo */}
          <button
            type="button"
            onClick={() => editor.commands.undo()}
            disabled={!editor.can().undo()}
            className="px-2 py-1 text-sm rounded hover:bg-gray-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-nhs-blue"
            title="Undo"
          >
            ↶
          </button>

          {/* Redo */}
          <button
            type="button"
            onClick={() => editor.commands.redo()}
            disabled={!editor.can().redo()}
            className="px-2 py-1 text-sm rounded hover:bg-gray-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-nhs-blue"
            title="Redo"
          >
            ↷
          </button>
        </div>
      )}

      {/* Editor Content */}
      <div
        className={`border border-gray-300 bg-white ${
          editable ? 'rounded-b-md' : 'rounded-md'
        } focus-within:ring-2 focus-within:ring-nhs-blue focus-within:ring-offset-1`}
        style={{ height }}
      >
        <EditorContent
          editor={editor}
          className="h-full overflow-y-auto p-3 focus:outline-none"
          aria-label={placeholder}
        />
      </div>
    </div>
  )
}

