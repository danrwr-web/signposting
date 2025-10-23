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
 * Converts plain text line breaks to HTML
 * @param text - The plain text content
 * @returns HTML string with line breaks converted to <br> tags
 */
export function convertLineBreaksToHtml(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }
  
  // Convert \n to <br> tags
  return text.replace(/\n/g, '<br>')
}

/**
 * Sanitizes and formats text content for display
 * Handles both HTML and plain text content
 * @param content - The content to sanitize and format
 * @returns Sanitized HTML string
 */
export function sanitizeAndFormatContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return ''
  }
  
  // Check if content already contains HTML tags
  const hasHtmlTags = /<[^>]+>/.test(content)
  
  if (hasHtmlTags) {
    // Content is already HTML, just sanitize it
    return sanitizeHtml(content)
  } else {
    // Content is plain text, convert line breaks and sanitize
    const htmlWithBreaks = convertLineBreaksToHtml(content)
    return sanitizeHtml(htmlWithBreaks)
  }
}
