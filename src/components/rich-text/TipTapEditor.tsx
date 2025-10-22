/**
 * TipTap Rich Text Editor Component
 * Production-grade editor with NHS styling and badge support
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { toast } from 'react-hot-toast'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import History from '@tiptap/extension-history'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { Badge } from '@/lib/tiptap/extensions/Badge'
import dynamic from 'next/dynamic'

// Dynamically import markdown utilities to avoid SSR issues
const { markdownToProseMirror, proseMirrorToMarkdown } = dynamic(() => import('tiptap-markdown'), { ssr: false })

interface TipTapEditorProps {
  value?: any // ProseMirror JSON document
  onChange: (json: any, markdown?: string) => void
  className?: string
  readOnly?: boolean
  placeholder?: string
  height?: number
}

// NHS colour palette
const NHS_COLORS = [
  { name: 'Blue', value: '#005EB8', class: 'text-blue-600' },
  { name: 'Red', value: '#DA291C', class: 'text-red-600' },
  { name: 'Orange', value: '#F47735', class: 'text-orange-500' },
  { name: 'Green', value: '#00A499', class: 'text-green-600' },
  { name: 'Purple', value: '#6A0DAD', class: 'text-purple-600' },
  { name: 'Pink', value: '#E5007E', class: 'text-pink-600' },
  { name: 'Black', value: '#000000', class: 'text-black' },
]

export default function TipTapEditor({
  value,
  onChange,
  className = '',
  readOnly = false,
  placeholder = 'Start typing...',
  height = 300
}: TipTapEditorProps) {
  const [mounted, setMounted] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showBadgePicker, setShowBadgePicker] = useState(false)
  const [showMarkdownModal, setShowMarkdownModal] = useState(false)
  const [markdownText, setMarkdownText] = useState('')

  // Ensure component is mounted before rendering
  useEffect(() => {
    setMounted(true)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-nhs-blue underline hover:text-nhs-dark-blue',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      TextStyle,
      Color.configure({
        types: ['textStyle'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      History,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Badge,
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      // Convert to markdown for back-compat
      try {
        const markdown = proseMirrorToMarkdown(json)
        onChange(json, markdown)
      } catch (error) {
        console.warn('Failed to convert to markdown:', error)
        onChange(json)
      }
    },
  })

  // Update editor content when value prop changes
  useEffect(() => {
    if (editor && value && JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) {
      editor.commands.setContent(value)
    }
  }, [editor, value])

  const addLink = useCallback(() => {
    if (!editor) return
    
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to)
    
    if (linkUrl) {
      editor.commands.setLink({ href: linkUrl })
      setLinkUrl('')
      setShowLinkModal(false)
    }
  }, [editor, linkUrl])

  const removeLink = useCallback(() => {
    if (!editor) return
    editor.commands.unsetLink()
  }, [editor])

  const insertBadge = useCallback((variant: 'red' | 'orange' | 'green' | 'purple' | 'pink') => {
    if (!editor) return
    editor.commands.toggleBadge({ variant })
    setShowBadgePicker(false)
  }, [editor])

  const importMarkdown = useCallback(() => {
    if (!editor || !markdownText) return
    
    try {
      const json = markdownToProseMirror(markdownText)
      editor.commands.setContent(json)
      setShowMarkdownModal(false)
      setMarkdownText('')
      toast.success('Markdown imported successfully!')
    } catch (error) {
      console.error('Failed to import markdown:', error)
      toast.error('Failed to import markdown. Please check the format.')
    }
  }, [editor, markdownText])

  const exportMarkdown = useCallback(() => {
    if (!editor) return
    
    try {
      const json = editor.getJSON()
      const markdown = proseMirrorToMarkdown(json)
      setMarkdownText(markdown)
      setShowMarkdownModal(true)
    } catch (error) {
      console.error('Failed to export markdown:', error)
      toast.error('Failed to export markdown.')
    }
  }, [editor])

  if (!mounted) {
    // Show a simple textarea while loading
    return (
      <textarea
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={6}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-nhs-blue focus:border-nhs-blue ${className}`}
      />
    )
  }

  if (!editor) {
    return null
  }

  return (
    <div className={`tiptap-editor ${className}`}>
      {/* Toolbar */}
      {!readOnly && (
        <div className="border border-gray-300 border-b-0 rounded-t-md bg-gray-50 p-2 flex flex-wrap gap-1">
          {/* Text Formatting */}
          <button
            type="button"
            onClick={() => editor.commands.toggleBold()}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 ${
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
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 ${
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
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 ${
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
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 ${
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
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 ${
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
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 ${
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
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 ${
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
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 ${
              editor.isActive('orderedList') ? 'bg-gray-200' : ''
            }`}
            title="Numbered List"
            aria-pressed={editor.isActive('orderedList')}
          >
            1.
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Code */}
          <button
            type="button"
            onClick={() => editor.commands.toggleCode()}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 ${
              editor.isActive('code') ? 'bg-gray-200' : ''
            }`}
            title="Inline Code"
            aria-pressed={editor.isActive('code')}
          >
            {'</>'}
          </button>
          <button
            type="button"
            onClick={() => editor.commands.toggleCodeBlock()}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 ${
              editor.isActive('codeBlock') ? 'bg-gray-200' : ''
            }`}
            title="Code Block"
            aria-pressed={editor.isActive('codeBlock')}
          >
            {'{ }'}
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Highlight */}
          <button
            type="button"
            onClick={() => editor.commands.toggleHighlight()}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 ${
              editor.isActive('highlight') ? 'bg-gray-200' : ''
            }`}
            title="Highlight"
            aria-pressed={editor.isActive('highlight')}
          >
            🖍️
          </button>

          {/* Text Colour */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="px-2 py-1 text-sm rounded hover:bg-gray-200"
              title="Text Colour"
            >
              A
            </button>
            {showColorPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-2 z-10">
                <div className="grid grid-cols-4 gap-1">
                  {NHS_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => {
                        editor.commands.setColor(color.value)
                        setShowColorPicker(false)
                      }}
                      className={`w-6 h-6 rounded border ${color.class}`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* NHS Badges */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowBadgePicker(!showBadgePicker)}
              className="px-2 py-1 text-sm rounded hover:bg-gray-200"
              title="NHS Badge"
            >
              🏷️
            </button>
            {showBadgePicker && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-2 z-10">
                <div className="space-y-1">
                  {(['red', 'orange', 'green', 'purple', 'pink'] as const).map((variant) => (
                    <button
                      key={variant}
                      type="button"
                      onClick={() => insertBadge(variant)}
                      className={`w-full text-left px-2 py-1 text-xs rounded hover:bg-gray-100 rt-badge rt-badge--${variant}`}
                    >
                      {variant.charAt(0).toUpperCase() + variant.slice(1)} Badge
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Link */}
          <button
            type="button"
            onClick={() => setShowLinkModal(true)}
            className={`px-2 py-1 text-sm rounded hover:bg-gray-200 ${
              editor.isActive('link') ? 'bg-gray-200' : ''
            }`}
            title="Add Link"
            aria-pressed={editor.isActive('link')}
          >
            🔗
          </button>
          {editor.isActive('link') && (
            <button
              type="button"
              onClick={removeLink}
              className="px-2 py-1 text-sm rounded hover:bg-gray-200"
              title="Remove Link"
            >
              🔗❌
            </button>
          )}

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Table */}
          <button
            type="button"
            onClick={() => editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true })}
            className="px-2 py-1 text-sm rounded hover:bg-gray-200"
            title="Insert Table"
          >
            ⚏
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Markdown Import/Export */}
          <button
            type="button"
            onClick={exportMarkdown}
            className="px-2 py-1 text-sm rounded hover:bg-gray-200"
            title="Export to Markdown"
          >
            📤
          </button>
          <button
            type="button"
            onClick={() => setShowMarkdownModal(true)}
            className="px-2 py-1 text-sm rounded hover:bg-gray-200"
            title="Import from Markdown"
          >
            📥
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* History */}
          <button
            type="button"
            onClick={() => editor.commands.undo()}
            disabled={!editor.can().undo()}
            className="px-2 py-1 text-sm rounded hover:bg-gray-200 disabled:opacity-50"
            title="Undo"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={() => editor.commands.redo()}
            disabled={!editor.can().redo()}
            className="px-2 py-1 text-sm rounded hover:bg-gray-200 disabled:opacity-50"
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

      {/* Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">Add Link</h3>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-nhs-blue focus:border-nhs-blue mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowLinkModal(false)
                  setLinkUrl('')
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addLink}
                className="px-4 py-2 bg-nhs-blue text-white rounded-lg hover:bg-nhs-dark-blue"
              >
                Add Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Markdown Modal */}
      {showMarkdownModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">Markdown Import/Export</h3>
            <textarea
              value={markdownText}
              onChange={(e) => setMarkdownText(e.target.value)}
              placeholder="Paste markdown here to import, or edit exported markdown..."
              className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-nhs-blue focus:border-nhs-blue mb-4 font-mono text-sm"
            />
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowMarkdownModal(false)
                  setMarkdownText('')
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={importMarkdown}
                disabled={!markdownText.trim()}
                className="px-4 py-2 bg-nhs-blue text-white rounded-lg hover:bg-nhs-dark-blue disabled:opacity-50"
              >
                Import Markdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NHS Badge Styles */}
      <style jsx global>{`
        .rt-badge {
          display: inline-block;
          border-radius: 0.25rem;
          padding: 0.125rem 0.375rem;
          font-size: 0.75rem;
          font-weight: 600;
          line-height: 1;
          vertical-align: baseline;
        }
        .rt-badge--red {
          background-color: #dc2626;
          color: white;
        }
        .rt-badge--orange {
          background-color: #f97316;
          color: white;
        }
        .rt-badge--green {
          background-color: #16a34a;
          color: white;
        }
        .rt-badge--purple {
          background-color: #9333ea;
          color: white;
        }
        .rt-badge--pink {
          background-color: #db2777;
          color: white;
        }
        
        .tiptap-editor .ProseMirror {
          outline: none;
          min-height: ${height - 100}px;
        }
        
        .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        
        .tiptap-editor .ProseMirror h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 1rem 0 0.5rem 0;
          color: #1f2937;
        }
        
        .tiptap-editor .ProseMirror h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0.75rem 0 0.5rem 0;
          color: #1f2937;
        }
        
        .tiptap-editor .ProseMirror h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0.5rem 0 0.25rem 0;
          color: #1f2937;
        }
        
        .tiptap-editor .ProseMirror ul, .tiptap-editor .ProseMirror ol {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }
        
        .tiptap-editor .ProseMirror li {
          margin: 0.25rem 0;
        }
        
        .tiptap-editor .ProseMirror code {
          background-color: #f3f4f6;
          border-radius: 0.25rem;
          padding: 0.125rem 0.25rem;
          font-family: 'Courier New', monospace;
          font-size: 0.875rem;
        }
        
        .tiptap-editor .ProseMirror pre {
          background-color: #f3f4f6;
          border-radius: 0.375rem;
          padding: 1rem;
          margin: 0.5rem 0;
          overflow-x: auto;
        }
        
        .tiptap-editor .ProseMirror pre code {
          background: none;
          padding: 0;
        }
        
        .tiptap-editor .ProseMirror table {
          border-collapse: collapse;
          margin: 0.5rem 0;
          width: 100%;
        }
        
        .tiptap-editor .ProseMirror th,
        .tiptap-editor .ProseMirror td {
          border: 1px solid #d1d5db;
          padding: 0.5rem;
          text-align: left;
        }
        
        .tiptap-editor .ProseMirror th {
          background-color: #f9fafb;
          font-weight: 600;
        }
        
        .tiptap-editor .ProseMirror a {
          color: #2563eb;
          text-decoration: underline;
        }
        
        .tiptap-editor .ProseMirror a:hover {
          color: #1d4ed8;
        }
        
        .tiptap-editor .ProseMirror mark {
          background-color: #fef3c7;
          padding: 0.125rem 0.25rem;
          border-radius: 0.125rem;
        }
      `}</style>
    </div>
  )
}
