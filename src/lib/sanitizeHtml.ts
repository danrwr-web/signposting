/**
 * HTML Sanitization Utility
 * Sanitizes HTML content to prevent XSS attacks while preserving formatting
 */

import DOMPurify from 'isomorphic-dompurify'

// Configure DOMPurify to allow safe formatting tags and styles
const sanitizeConfig = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 'mark', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'code', 'pre',
    'a'
  ],
  ALLOWED_ATTR: [
    'style', 'href', 'target', 'rel', 'class'
  ],
  ALLOWED_SCHEMES: ['http', 'https', 'mailto'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
}

/**
 * Sanitizes HTML content for safe rendering
 * @param html - The HTML content to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }
  
  return DOMPurify.sanitize(html, sanitizeConfig)
}

/**
 * Sanitizes HTML content while preserving links
 * @param html - The HTML content to sanitize
 * @returns Sanitized HTML string with safe links
 */
export function sanitizeHtmlWithLinks(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }
  
  const configWithLinks = {
    ...sanitizeConfig,
    ADD_ATTR: ['target', 'rel'],
    ADD_TAGS: ['a'],
  }
  
  return DOMPurify.sanitize(html, configWithLinks)
}

/**
 * Checks if HTML content is safe to render
 * @param html - The HTML content to check
 * @returns True if the content is safe
 */
export function isHtmlSafe(html: string): boolean {
  if (!html || typeof html !== 'string') {
    return true
  }
  
  const sanitized = DOMPurify.sanitize(html, sanitizeConfig)
  return sanitized === html
}
