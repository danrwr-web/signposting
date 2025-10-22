/**
 * Tests for ProseMirror Utilities
 */

import { proseMirrorToHtml, proseMirrorToText, isProseMirrorEmpty } from '@/lib/proseMirrorUtils'

// Mock the extensions
jest.mock('@tiptap/html', () => ({
  generateHTML: jest.fn((json: any) => '<p>Mock HTML</p>')
}))

jest.mock('@/lib/sanitizeHtml', () => ({
  sanitizeHtmlWithLinks: jest.fn((html: string) => html)
}))

describe('ProseMirror Utilities', () => {
  describe('proseMirrorToHtml', () => {
    it('converts ProseMirror JSON to HTML', () => {
      const json = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello world' }]
          }
        ]
      }
      
      const result = proseMirrorToHtml(json)
      expect(result).toBe('<p>Mock HTML</p>')
    })

    it('handles empty input', () => {
      expect(proseMirrorToHtml(null)).toBe('')
      expect(proseMirrorToHtml(undefined)).toBe('')
    })

    it('handles conversion errors gracefully', () => {
      const { generateHTML } = require('@tiptap/html')
      generateHTML.mockImplementationOnce(() => {
        throw new Error('Conversion failed')
      })
      
      const result = proseMirrorToHtml({ invalid: 'json' })
      expect(result).toBe('')
    })
  })

  describe('proseMirrorToText', () => {
    it('extracts text from ProseMirror JSON', () => {
      const json = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Hello ' },
              { type: 'text', text: 'world' }
            ]
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Second paragraph' }]
          }
        ]
      }
      
      const result = proseMirrorToText(json)
      expect(result).toBe('Hello world\nSecond paragraph')
    })

    it('handles empty content', () => {
      const json = { type: 'doc', content: [] }
      expect(proseMirrorToText(json)).toBe('')
    })

    it('handles null input', () => {
      expect(proseMirrorToText(null)).toBe('')
      expect(proseMirrorToText(undefined)).toBe('')
    })
  })

  describe('isProseMirrorEmpty', () => {
    it('returns true for empty document', () => {
      const json = { type: 'doc', content: [] }
      expect(isProseMirrorEmpty(json)).toBe(true)
    })

    it('returns true for document with empty paragraphs', () => {
      const json = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [] },
          { type: 'paragraph', content: [] }
        ]
      }
      expect(isProseMirrorEmpty(json)).toBe(true)
    })

    it('returns false for document with content', () => {
      const json = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello world' }]
          }
        ]
      }
      expect(isProseMirrorEmpty(json)).toBe(false)
    })

    it('handles null input', () => {
      expect(isProseMirrorEmpty(null)).toBe(true)
      expect(isProseMirrorEmpty(undefined)).toBe(true)
    })
  })
})
