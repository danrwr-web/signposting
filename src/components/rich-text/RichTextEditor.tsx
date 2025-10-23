/**
 * NHS-Styled TipTap Rich Text Editor
 * Provides rich text editing with NHS styling, colour support, and accessibility
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  className?: string
  readOnly?: boolean
  placeholder?: string
  height?: number
  "data-testid"?: string
}

// NHS colour palette with more colours and better organization
const NHS_COLORS = [
  { name: 'NHS Blue', value: '#005EB8', class: 'text-nhs-blue' },
  { name: 'NHS Red', value: '#DA020E', class: 'text-red-600' },
  { name: 'NHS Orange', value: '#F59E0B', class: 'text-orange-500' },
  { name: 'NHS Green', value: '#00A499', class: 'text-green-600' },
  { name: 'Purple', value: '#6A0DAD', class: 'text-purple-600' },
  { name: 'Pink', value: '#E5007E', class: 'text-pink-600' },
  { name: 'Black', value: '#000000', class: 'text-black' },
  { name: 'Dark Gray', value: '#374151', class: 'text-gray-700' },
  { name: 'Brown', value: '#92400e', class: 'text-amber-800' },
  { name: 'Teal', value: '#0d9488', class: 'text-teal-600' },
  { name: 'Indigo', value: '#4f46e5', class: 'text-indigo-600' },
  { name: 'Rose', value: '#e11d48', class: 'text-rose-600' },
]

export default function RichTextEditor({
  value,
  onChange,
  className = '',
  readOnly = false,
  placeholder = 'Start typing...',
  height = 300,
  "data-testid": testId
}: RichTextEditorProps) {
  const [mounted, setMounted] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const colorPickerRef = useRef<HTMLDivElement>(null)

  // Ensure component is mounted before rendering
  useEffect(() => {
    setMounted(true)
  }, [])

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Underline,
      Highlight,
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none',
      },
    },
  }, [mounted]) // Only create editor after component is mounted

  // Update editor content when value prop changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value)
    }
  }, [editor, value])

  if (!mounted || !editor) {
    return (
      <div className={`w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 animate-pulse ${className}`}>
        Loading editor...
      </div>
    )
  }

  return (
    <div className={`rich-text-editor ${className}`} data-testid={testId}>
      {/* Toolbar */}
      {!readOnly && (
        <div className="border border-gray-300 border-b-0 rounded-t-md bg-gray-50 p-2 flex flex-wrap gap-1">
          {/* Text Formatting */}
          <button
            type="button"
            onClick={() => editor.commands.toggleBold()}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
              editor.isActive('bold') ? 'bg-gray-200' : ''
            }`}
            title="Bold"
            aria-pressed={editor.isActive('bold')}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={() => editor.commands.toggleItalic()}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
              editor.isActive('italic') ? 'bg-gray-200' : ''
            }`}
            title="Italic"
            aria-pressed={editor.isActive('italic')}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={() => editor.commands.toggleUnderline()}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
              editor.isActive('underline') ? 'bg-gray-200' : ''
            }`}
            title="Underline"
            aria-pressed={editor.isActive('underline')}
          >
            <u>U</u>
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Headings */}
          <button
            type="button"
            onClick={() => editor.commands.toggleHeading({ level: 1 })}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
              editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : ''
            }`}
            title="Heading 1"
            aria-pressed={editor.isActive('heading', { level: 1 })}
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => editor.commands.toggleHeading({ level: 2 })}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
              editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''
            }`}
            title="Heading 2"
            aria-pressed={editor.isActive('heading', { level: 2 })}
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.commands.toggleHeading({ level: 3 })}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
              editor.isActive('heading', { level: 3 }) ? 'bg-gray-200' : ''
            }`}
            title="Heading 3"
            aria-pressed={editor.isActive('heading', { level: 3 })}
          >
            H3
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Lists */}
          <button
            type="button"
            onClick={() => editor.commands.toggleBulletList()}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
              editor.isActive('bulletList') ? 'bg-gray-200' : ''
            }`}
            title="Bullet List"
            aria-pressed={editor.isActive('bulletList')}
          >
            •
          </button>
          <button
            type="button"
            onClick={() => editor.commands.toggleOrderedList()}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
              editor.isActive('orderedList') ? 'bg-gray-200' : ''
            }`}
            title="Numbered List"
            aria-pressed={editor.isActive('orderedList')}
          >
            1.
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Highlight */}
          <button
            type="button"
            onClick={() => editor.commands.toggleHighlight()}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
              editor.isActive('highlight') ? 'bg-gray-200' : ''
            }`}
            title="Highlight"
            aria-pressed={editor.isActive('highlight')}
          >
            🖍️
          </button>

          {/* Text Colour */}
          <div className="relative" ref={colorPickerRef}>
            <button
              type="button"
              onClick={() => setShowColorPicker(!showColorPicker)}
              className={`px-2 py-1 text-sm rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-nhs-blue ${
                editor.isActive('textStyle') ? 'bg-gray-200' : ''
              }`}
              title="Text Colour"
              aria-expanded={showColorPicker}
              aria-haspopup="true"
            >
              <span 
                className="font-bold"
                style={{ 
                  color: editor.getAttributes('textStyle').color || '#000000'
                }}
              >
                A
              </span>
            </button>
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3 z-10 min-w-[200px]">
                <div className="text-xs font-medium text-gray-600 mb-2">Text Colour</div>
                <div className="grid grid-cols-3 gap-2">
                  {NHS_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => {
                        console.log('Setting colour:', color.value)
                        editor.commands.setMark('textStyle', { color: color.value })
                        setShowColorPicker(false)
                      }}
                      className={`w-8 h-8 rounded border-2 hover:ring-2 hover:ring-nhs-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue transition-all ${
                        editor.isActive('textStyle', { color: color.value }) ? 'ring-2 ring-nhs-blue' : ''
                      }`}
                      style={{ 
                        backgroundColor: color.value,
                        borderColor: color.value === '#000000' ? '#e5e7eb' : color.value
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
                      console.log('Removing colour')
                      editor.commands.unsetMark('textStyle')
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

          {/* History */}
          <button
            type="button"
            onClick={() => editor.commands.undo()}
            disabled={!editor.can().undo()}
            className="px-2 py-1 text-sm rounded hover:bg-gray-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-nhs-blue"
            title="Undo"
          >
            ↶
          </button>
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
        className={`border border-gray-300 rounded-b-md bg-white ${
          readOnly ? 'rounded-md' : ''
        }`}
        style={{ minHeight: `${height}px` }}
      >
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none p-4 focus:outline-none"
        />
      </div>

      {/* NHS Styling */}
      <style jsx global>{`
        .rich-text-editor .ProseMirror {
          outline: none;
          min-height: ${height - 100}px;
        }
        
        .rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        
        .rich-text-editor .ProseMirror h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 1rem 0 0.5rem 0;
          color: #1f2937;
        }
        
        .rich-text-editor .ProseMirror h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0.75rem 0 0.5rem 0;
          color: #1f2937;
        }
        
        .rich-text-editor .ProseMirror h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0.5rem 0 0.25rem 0;
          color: #1f2937;
        }
        
        .rich-text-editor .ProseMirror ul, .rich-text-editor .ProseMirror ol {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }
        
        .rich-text-editor .ProseMirror li {
          margin: 0.25rem 0;
        }
        
        .rich-text-editor .ProseMirror code {
          background-color: #f3f4f6;
          border-radius: 0.25rem;
          padding: 0.125rem 0.25rem;
          font-family: 'Courier New', monospace;
          font-size: 0.875rem;
        }
        
        .rich-text-editor .ProseMirror pre {
          background-color: #f3f4f6;
          border-radius: 0.375rem;
          padding: 1rem;
          margin: 0.5rem 0;
          overflow-x: auto;
        }
        
        .rich-text-editor .ProseMirror pre code {
          background: none;
          padding: 0;
        }
        
        .rich-text-editor .ProseMirror a {
          color: #005EB8;
          text-decoration: underline;
        }
        
        .rich-text-editor .ProseMirror a:hover {
          color: #003d82;
        }
        
        .rich-text-editor .ProseMirror mark {
          background-color: #fef3c7;
          padding: 0.125rem 0.25rem;
          border-radius: 0.125rem;
        }
        
        /* Ensure colour styles are applied */
        .rich-text-editor .ProseMirror span[style*="color"] {
          color: inherit !important;
        }
        
        /* Focus styling */
        .rich-text-editor .ProseMirror:focus-within {
          border-color: #005EB8;
          box-shadow: 0 0 0 3px rgba(0, 94, 184, 0.1);
        }
      `}</style>
    </div>
  )
}