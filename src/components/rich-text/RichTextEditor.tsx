/**
 * Minimal TipTap Rich Text Editor
 * Simplified version to resolve extension loading issues
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  className?: string
  readOnly?: boolean
  placeholder?: string
  height?: number
  "data-testid"?: string
}

// NHS colour palette
const NHS_COLORS = [
  { name: 'NHS Blue', value: '#005EB8' },
  { name: 'NHS Red', value: '#DA020E' },
  { name: 'NHS Orange', value: '#F59E0B' },
  { name: 'NHS Green', value: '#00A499' },
  { name: 'Purple', value: '#6A0DAD' },
  { name: 'Pink', value: '#E5007E' },
  { name: 'Black', value: '#000000' },
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

  // Create editor with minimal extensions
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle.configure({}),
      Color.configure({
        types: ['textStyle'],
      }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
    },
  }, [mounted])

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
            title="Bullet List"
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
            title="Numbered List"
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
                        editor.commands.setColor(color.value)
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
                      editor.commands.unsetColor()
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
        className="border border-gray-300 rounded-b-md bg-white"
        style={{ height: height }}
      >
        <EditorContent 
          editor={editor} 
          className="h-full overflow-y-auto p-3 focus:outline-none"
        />
      </div>

      {/* Styles */}
      <style jsx>{`
        .rich-text-editor .ProseMirror {
          outline: none;
          min-height: 100px;
        }
        
        .rich-text-editor .ProseMirror p {
          margin: 0.5rem 0;
          line-height: 1.6;
        }
        
        .rich-text-editor .ProseMirror p:first-child {
          margin-top: 0;
        }
        
        .rich-text-editor .ProseMirror p:last-child {
          margin-bottom: 0;
        }
        
        .rich-text-editor .ProseMirror ul, .rich-text-editor .ProseMirror ol {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }
        
        .rich-text-editor .ProseMirror li {
          margin: 0.25rem 0;
        }
        
        .rich-text-editor .ProseMirror strong {
          font-weight: 700;
        }
        
        .rich-text-editor .ProseMirror em {
          font-style: italic;
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