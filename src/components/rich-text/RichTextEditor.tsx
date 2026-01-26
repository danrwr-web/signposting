/**
 * Minimal TipTap Rich Text Editor
 * Simplified version to resolve extension loading issues
 */

'use client'

import SafeTipTapEditor from '@/components/editor/SafeTipTapEditor'

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
  "data-testid"?: string
}

export default function RichTextEditor({
  docId = 'rich-text-editor',
  value,
  onChange,
  className = '',
  readOnly = false,
  placeholder = 'Start typing...',
  height = 300,
  "data-testid": testId
}: RichTextEditorProps) {
  return (
    <SafeTipTapEditor
      docId={docId}
      initialHtml={value}
      editable={!readOnly}
      onChange={onChange}
      className={className}
      placeholder={placeholder}
      height={height}
      data-testid={testId}
    />
  )
}