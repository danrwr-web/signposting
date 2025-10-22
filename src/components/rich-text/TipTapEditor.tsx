/**
 * TipTap Rich Text Editor Component
 * Production-grade editor with NHS styling and badge support
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { toast } from 'react-hot-toast'
import dynamic from 'next/dynamic'

// Create a simple fallback editor component
const SimpleTextEditor = ({ value, onChange, placeholder, height }: any) => (
  <textarea
    value={typeof value === 'string' ? value : ''}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    rows={Math.max(6, Math.floor(height / 25))}
    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-nhs-blue focus:border-nhs-blue"
  />
)

// Dynamically import TipTap editor with fallback
const TipTapEditorCore = dynamic(() => import('./TipTapEditorCore'), { 
  ssr: false,
  loading: () => <SimpleTextEditor value="" onChange={() => {}} placeholder="Loading editor..." height={200} />
})

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

  // Ensure component is mounted before rendering
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <SimpleTextEditor
        value={value}
        onChange={(text: string) => onChange(text)}
        placeholder={placeholder}
        height={height}
      />
    )
  }

  return (
    <TipTapEditorCore
      value={value}
      onChange={onChange}
      className={className}
      readOnly={readOnly}
      placeholder={placeholder}
      height={height}
    />
  )
}
