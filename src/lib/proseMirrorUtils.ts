/**
 * ProseMirror JSON to HTML conversion utilities
 * For rendering TipTap content in read-only mode
 */

import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { Badge } from '@/lib/tiptap/extensions/Badge'
import { sanitizeHtmlWithLinks } from '@/lib/sanitizeHtml'

// Extensions used for rendering (same as editor)
const extensions = [
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
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
  Badge,
]

/**
 * Convert ProseMirror JSON to sanitized HTML
 * @param json - ProseMirror JSON document
 * @returns Sanitized HTML string
 */
export function proseMirrorToHtml(json: any): string {
  if (!json) return ''
  
  try {
    const html = generateHTML(json, extensions)
    return sanitizeHtmlWithLinks(html)
  } catch (error) {
    console.error('Failed to convert ProseMirror JSON to HTML:', error)
    return ''
  }
}

/**
 * Convert ProseMirror JSON to HTML with custom sanitization
 * @param json - ProseMirror JSON document
 * @param sanitize - Whether to sanitize the HTML (default: true)
 * @returns HTML string
 */
export function proseMirrorToHtmlCustom(json: any, sanitize: boolean = true): string {
  if (!json) return ''
  
  try {
    const html = generateHTML(json, extensions)
    return sanitize ? sanitizeHtmlWithLinks(html) : html
  } catch (error) {
    console.error('Failed to convert ProseMirror JSON to HTML:', error)
    return ''
  }
}

/**
 * Check if content is empty
 * @param json - ProseMirror JSON document
 * @returns true if content is empty
 */
export function isProseMirrorEmpty(json: any): boolean {
  if (!json || !json.content) return true
  
  // Check if all content is empty
  return json.content.every((node: any) => {
    if (node.type === 'paragraph') {
      return !node.content || node.content.length === 0
    }
    return false
  })
}

/**
 * Get plain text from ProseMirror JSON
 * @param json - ProseMirror JSON document
 * @returns Plain text string
 */
export function proseMirrorToText(json: any): string {
  if (!json || !json.content) return ''
  
  const extractText = (node: any): string => {
    if (node.type === 'text') {
      return node.text || ''
    }
    
    if (node.content) {
      return node.content.map(extractText).join('')
    }
    
    return ''
  }
  
  return json.content.map(extractText).join('\n')
}
