/**
 * Rich Text Editor Component
 * A markdown editor for editing instructions with formatting
 */

'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import the markdown editor to avoid SSR issues
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

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
      <MDEditor
        value={value}
        onChange={(val) => onChange(val || '')}
        height={height}
        data-color-mode="light"
        preview="edit"
        hideToolbar={false}
        visibleDragBar={false}
        textareaProps={{
          placeholder: placeholder,
          style: {
            fontSize: 14,
            fontFamily: 'inherit',
          },
        }}
      />
      <style jsx global>{`
        .rich-text-editor .w-md-editor {
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
        }
        .rich-text-editor .w-md-editor:focus-within {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .rich-text-editor .w-md-editor-toolbar {
          background-color: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }
        .rich-text-editor .w-md-editor-toolbar button {
          color: #374151;
        }
        .rich-text-editor .w-md-editor-toolbar button:hover {
          background-color: #e5e7eb;
        }
        .rich-text-editor .w-md-editor-text {
          background-color: white;
        }
        .rich-text-editor .w-md-editor-text-pre {
          font-family: inherit;
          font-size: 14px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  )
}
