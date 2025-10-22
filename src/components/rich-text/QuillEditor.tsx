/**
 * NHS-Styled Quill Rich Text Editor
 * Provides rich text editing with NHS colour palette and styling
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'react-hot-toast'

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { 
  ssr: false,
  loading: () => (
    <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 animate-pulse">
      Loading editor...
    </div>
  )
})

interface QuillEditorProps {
  value?: string
  onChange: (html: string) => void
  className?: string
  readOnly?: boolean
  placeholder?: string
  height?: number
}

// NHS colour palette
const NHS_COLORS = [
  '#005EB8', // NHS Blue
  '#DA020E', // NHS Red
  '#F59E0B', // NHS Orange
  '#00A499', // NHS Green
  '#6A0DAD', // NHS Purple
  '#E5007E', // NHS Pink
  '#000000', // Black
  '#FFFFFF', // White
]

export default function QuillEditor({
  value = '',
  onChange,
  className = '',
  readOnly = false,
  placeholder = 'Start typing...',
  height = 300
}: QuillEditorProps) {
  const [mounted, setMounted] = useState(false)
  const quillRef = useRef<any>(null)

  // Ensure component is mounted before rendering
  useEffect(() => {
    setMounted(true)
  }, [])

  // Quill modules configuration
  const modules = {
    toolbar: readOnly ? false : {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': NHS_COLORS }, { 'background': NHS_COLORS }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        ['blockquote', 'code-block'],
        ['link'],
        ['clean']
      ],
      handlers: {
        // Custom handler for NHS badges
        'badge': function() {
          const quill = quillRef.current?.getEditor()
          if (quill) {
            const range = quill.getSelection()
            if (range) {
              const text = quill.getText(range.index, range.length) || 'Badge'
              quill.insertText(range.index, text, 'user')
              quill.formatText(range.index, text.length, 'background', '#005EB8')
              quill.formatText(range.index, text.length, 'color', '#FFFFFF')
            }
          }
        }
      }
    },
    clipboard: {
      matchVisual: false,
    }
  }

  // Quill formats
  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'list', 'bullet', 'indent',
    'blockquote', 'code-block',
    'link'
  ]

  const handleChange = (content: string) => {
    onChange(content)
  }

  if (!mounted) {
    return (
      <div className={`w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 animate-pulse ${className}`}>
        Loading editor...
      </div>
    )
  }

  return (
    <div className={`quill-editor ${className}`}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        readOnly={readOnly}
        placeholder={placeholder}
        style={{ height: `${height}px` }}
      />
      
      {/* NHS Badge Button */}
      {!readOnly && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => {
              const quill = quillRef.current?.getEditor()
              if (quill) {
                const range = quill.getSelection()
                if (range) {
                  const text = quill.getText(range.index, range.length) || 'Badge'
                  quill.insertText(range.index, text, 'user')
                  quill.formatText(range.index, text.length, 'background', '#005EB8')
                  quill.formatText(range.index, text.length, 'color', '#FFFFFF')
                  quill.setSelection(range.index + text.length)
                } else {
                  toast.error('Please select text to create a badge')
                }
              }
            }}
            className="px-3 py-1 text-xs bg-nhs-blue text-white rounded hover:bg-nhs-dark-blue transition-colors"
          >
            Add NHS Badge
          </button>
        </div>
      )}

      {/* NHS Styling */}
      <style jsx global>{`
        .quill-editor .ql-toolbar {
          border-top: 1px solid #d1d5db;
          border-left: 1px solid #d1d5db;
          border-right: 1px solid #d1d5db;
          border-bottom: none;
          border-radius: 0.375rem 0.375rem 0 0;
          background-color: #f9fafb;
        }
        
        .quill-editor .ql-container {
          border-bottom: 1px solid #d1d5db;
          border-left: 1px solid #d1d5db;
          border-right: 1px solid #d1d5db;
          border-top: none;
          border-radius: 0 0 0.375rem 0.375rem;
          font-family: inherit;
        }
        
        .quill-editor .ql-editor {
          min-height: ${height - 100}px;
          padding: 1rem;
          font-size: 0.875rem;
          line-height: 1.5;
        }
        
        .quill-editor .ql-editor.ql-blank::before {
          color: #9ca3af;
          font-style: normal;
        }
        
        .quill-editor .ql-editor h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 1rem 0 0.5rem 0;
          color: #1f2937;
        }
        
        .quill-editor .ql-editor h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0.75rem 0 0.5rem 0;
          color: #1f2937;
        }
        
        .quill-editor .ql-editor h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0.5rem 0 0.25rem 0;
          color: #1f2937;
        }
        
        .quill-editor .ql-editor ul, .quill-editor .ql-editor ol {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }
        
        .quill-editor .ql-editor li {
          margin: 0.25rem 0;
        }
        
        .quill-editor .ql-editor blockquote {
          border-left: 4px solid #005EB8;
          margin: 1rem 0;
          padding-left: 1rem;
          color: #6b7280;
          font-style: italic;
        }
        
        .quill-editor .ql-editor code {
          background-color: #f3f4f6;
          border-radius: 0.25rem;
          padding: 0.125rem 0.25rem;
          font-family: 'Courier New', monospace;
          font-size: 0.875rem;
        }
        
        .quill-editor .ql-editor pre {
          background-color: #f3f4f6;
          border-radius: 0.375rem;
          padding: 1rem;
          margin: 0.5rem 0;
          overflow-x: auto;
        }
        
        .quill-editor .ql-editor pre code {
          background: none;
          padding: 0;
        }
        
        .quill-editor .ql-editor a {
          color: #005EB8;
          text-decoration: underline;
        }
        
        .quill-editor .ql-editor a:hover {
          color: #003d82;
        }
        
        /* NHS Badge styling */
        .quill-editor .ql-editor span[style*="background-color: rgb(0, 94, 184)"] {
          background-color: #005EB8 !important;
          color: white !important;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
        }
        
        /* Toolbar button styling */
        .quill-editor .ql-toolbar .ql-picker-label,
        .quill-editor .ql-toolbar button {
          border-radius: 0.25rem;
          margin: 0.125rem;
        }
        
        .quill-editor .ql-toolbar .ql-picker-label:hover,
        .quill-editor .ql-toolbar button:hover {
          background-color: #e5e7eb;
        }
        
        .quill-editor .ql-toolbar .ql-picker-label.ql-active,
        .quill-editor .ql-toolbar button.ql-active {
          background-color: #d1d5db;
        }
        
        /* Focus styling */
        .quill-editor .ql-container.ql-snow:focus-within {
          border-color: #005EB8;
          box-shadow: 0 0 0 3px rgba(0, 94, 184, 0.1);
        }
      `}</style>
    </div>
  )
}
