/**
 * NHS-Styled Markdown Rich Text Editor
 * Provides markdown editing with NHS styling and branding
 */

'use client'

import dynamic from "next/dynamic"
import { useMemo } from "react"

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false })

interface RichTextEditorProps {
  value: string
  onChange: (v: string) => void
  className?: string
  readOnly?: boolean
  placeholder?: string
  height?: number
  "data-testid"?: string
}

export default function RichTextEditor({
  value,
  onChange,
  className = '',
  readOnly = false,
  placeholder = 'Start typing...',
  height = 300,
  "data-testid": testId
}: RichTextEditorProps) {
  const v = useMemo(() => value ?? "", [value])

  return (
    <div 
      className={`rich-text-editor ${className}`}
      data-color-mode="light" 
      data-testid={testId}
    >
      <MDEditor 
        value={v} 
        onChange={(v) => onChange(v ?? "")}
        preview={readOnly ? 'preview' : 'edit'}
        hideToolbar={readOnly}
        height={height}
        data-color-mode="light"
      />
      
      {/* NHS Styling */}
      <style jsx global>{`
        .rich-text-editor .w-md-editor {
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-family: inherit;
        }
        
        .rich-text-editor .w-md-editor-toolbar {
          background-color: #f9fafb;
          border-bottom: 1px solid #d1d5db;
          border-radius: 0.375rem 0.375rem 0 0;
        }
        
        .rich-text-editor .w-md-editor-text-container {
          border-radius: 0 0 0.375rem 0.375rem;
        }
        
        .rich-text-editor .w-md-editor-text {
          font-size: 0.875rem;
          line-height: 1.5;
          padding: 1rem;
        }
        
        .rich-text-editor .w-md-editor-text-input {
          font-size: 0.875rem;
          line-height: 1.5;
        }
        
        .rich-text-editor .w-md-editor-text-input::placeholder {
          color: #9ca3af;
        }
        
        .rich-text-editor .w-md-editor-preview {
          padding: 1rem;
          font-size: 0.875rem;
          line-height: 1.5;
        }
        
        .rich-text-editor .w-md-editor-preview h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 1rem 0 0.5rem 0;
          color: #1f2937;
        }
        
        .rich-text-editor .w-md-editor-preview h2 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0.75rem 0 0.5rem 0;
          color: #1f2937;
        }
        
        .rich-text-editor .w-md-editor-preview h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0.5rem 0 0.25rem 0;
          color: #1f2937;
        }
        
        .rich-text-editor .w-md-editor-preview ul, 
        .rich-text-editor .w-md-editor-preview ol {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }
        
        .rich-text-editor .w-md-editor-preview li {
          margin: 0.25rem 0;
        }
        
        .rich-text-editor .w-md-editor-preview blockquote {
          border-left: 4px solid #005EB8;
          margin: 1rem 0;
          padding-left: 1rem;
          color: #6b7280;
          font-style: italic;
        }
        
        .rich-text-editor .w-md-editor-preview code {
          background-color: #f3f4f6;
          border-radius: 0.25rem;
          padding: 0.125rem 0.25rem;
          font-family: 'Courier New', monospace;
          font-size: 0.875rem;
        }
        
        .rich-text-editor .w-md-editor-preview pre {
          background-color: #f3f4f6;
          border-radius: 0.375rem;
          padding: 1rem;
          margin: 0.5rem 0;
          overflow-x: auto;
        }
        
        .rich-text-editor .w-md-editor-preview pre code {
          background: none;
          padding: 0;
        }
        
        .rich-text-editor .w-md-editor-preview a {
          color: #005EB8;
          text-decoration: underline;
        }
        
        .rich-text-editor .w-md-editor-preview a:hover {
          color: #003d82;
        }
        
        /* NHS Badge styling */
        .rich-text-editor .w-md-editor-preview .nhs-badge {
          background-color: #005EB8;
          color: white;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
          display: inline-block;
          margin: 0.125rem;
        }
        
        /* Toolbar button styling */
        .rich-text-editor .w-md-editor-toolbar button {
          border-radius: 0.25rem;
          margin: 0.125rem;
        }
        
        .rich-text-editor .w-md-editor-toolbar button:hover {
          background-color: #e5e7eb;
        }
        
        .rich-text-editor .w-md-editor-toolbar button.active {
          background-color: #d1d5db;
        }
        
        /* Focus styling */
        .rich-text-editor .w-md-editor:focus-within {
          border-color: #005EB8;
          box-shadow: 0 0 0 3px rgba(0, 94, 184, 0.1);
        }
      `}</style>
    </div>
  )
}
