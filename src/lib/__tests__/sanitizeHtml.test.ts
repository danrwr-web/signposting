/**
 * Tests for HTML Sanitization Utility
 */

import { sanitizeHtml, sanitizeHtmlWithLinks, isHtmlSafe } from '@/lib/sanitizeHtml'

describe('HTML Sanitization', () => {
  describe('sanitizeHtml', () => {
    it('sanitizes dangerous HTML', () => {
      const dangerousHtml = '<script>alert("xss")</script><p>Safe content</p>'
      const result = sanitizeHtml(dangerousHtml)
      
      expect(result).toBe('<p>Safe content</p>')
      expect(result).not.toContain('<script>')
    })

    it('allows safe HTML tags', () => {
      const safeHtml = '<p><strong>Bold</strong> and <em>italic</em> text</p>'
      const result = sanitizeHtml(safeHtml)
      
      expect(result).toContain('<p>')
      expect(result).toContain('<strong>')
      expect(result).toContain('<em>')
    })

    it('removes dangerous attributes', () => {
      const dangerousHtml = '<p onclick="alert(\'xss\')">Click me</p>'
      const result = sanitizeHtml(dangerousHtml)
      
      expect(result).toBe('<p>Click me</p>')
      expect(result).not.toContain('onclick')
    })

    it('handles empty input', () => {
      expect(sanitizeHtml('')).toBe('')
      expect(sanitizeHtml(null as any)).toBe('')
      expect(sanitizeHtml(undefined as any)).toBe('')
    })
  })

  describe('sanitizeHtmlWithLinks', () => {
    it('adds rel="noopener noreferrer" to external links', () => {
      const htmlWithLink = '<p>Visit <a href="https://external.com">external site</a></p>'
      const result = sanitizeHtmlWithLinks(htmlWithLink)
      
      expect(result).toContain('rel="noopener noreferrer"')
      expect(result).toContain('target="_blank"')
    })

    it('preserves internal links without modification', () => {
      const htmlWithInternalLink = '<p>Visit <a href="/internal">internal page</a></p>'
      const result = sanitizeHtmlWithLinks(htmlWithInternalLink)
      
      expect(result).toContain('href="/internal"')
      expect(result).not.toContain('target="_blank"')
    })
  })

  describe('isHtmlSafe', () => {
    it('returns true for safe HTML', () => {
      const safeHtml = '<p>Safe content</p>'
      expect(isHtmlSafe(safeHtml)).toBe(true)
    })

    it('returns false for dangerous HTML', () => {
      const dangerousHtml = '<script>alert("xss")</script>'
      expect(isHtmlSafe(dangerousHtml)).toBe(false)
    })

    it('returns true for empty input', () => {
      expect(isHtmlSafe('')).toBe(true)
      expect(isHtmlSafe(null as any)).toBe(true)
    })
  })
})
