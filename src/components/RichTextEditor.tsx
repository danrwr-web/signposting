/**
 * Rich Text Editor Component
 * A simple rich text editor using react-quill for editing instructions
 */

'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import react-quill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })
import 'react-quill/dist/quill.snow.css'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  height?: number
}

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Enter detailed instructions...",
  height = 200 
}: RichTextEditorProps) {
  const [mounted, setMounted] = useState(false)

  // Ensure component is mounted before rendering to avoid SSR issues
  useEffect(() => {
    setMounted(true)
  }, [])

  // Custom toolbar configuration
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['link'],
      ['clean']
    ],
  }

  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'color', 'background', 'list', 'bullet', 'indent',
    'align', 'link'
  ]

  if (!mounted) {
    // Show a simple textarea while loading
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={6}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-nhs-blue focus:border-nhs-blue"
      />
    )
  }

  return (
    <div className="rich-text-editor">
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
        style={{ height: `${height}px` }}
      />
      <style jsx global>{`
        .rich-text-editor .ql-editor {
          min-height: ${height - 50}px;
        }
        .rich-text-editor .ql-toolbar {
          border-top: 1px solid #ccc;
          border-left: 1px solid #ccc;
          border-right: 1px solid #ccc;
        }
        .rich-text-editor .ql-container {
          border-bottom: 1px solid #ccc;
          border-left: 1px solid #ccc;
          border-right: 1px solid #ccc;
        }
        .rich-text-editor .ql-editor.ql-blank::before {
          color: #9ca3af;
          font-style: italic;
        }
      `}</style>
    </div>
  )
}
