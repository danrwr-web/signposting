/**
 * HTML Sanitization Utility
 * Configures DOMPurify for safe HTML rendering
 */

import DOMPurify from 'isomorphic-dompurify'

// Configure DOMPurify for safe HTML rendering
const sanitizeConfig = {
  // Allow safe HTML tags
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'mark',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span', 'div'
  ],
  
  // Allow safe attributes
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'class', 'id',
    'style', 'title', 'aria-label', 'aria-describedby'
  ],
  
  // Allow safe CSS properties
  ALLOWED_CSS: {
    'color': true,
    'background-color': true,
    'font-weight': true,
    'font-style': true,
    'text-decoration': true,
    'background': true
  },
  
  // Add rel="noopener noreferrer" to external links
  ADD_ATTR: ['target'],
  ADD_URI_SAFE_ATTR: ['href'],
  
  // Transform links to be safe
  SANITIZE_DOM: true,
  
  // Remove dangerous elements
  FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input'],
  FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur']
}

/**
 * Sanitize HTML content for safe rendering
 * @param html - Raw HTML string
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  if (!html) return ''
  
  return DOMPurify.sanitize(html, sanitizeConfig)
}

/**
 * Sanitize HTML and add safe link attributes
 * @param html - Raw HTML string
 * @returns Sanitized HTML with safe links
 */
export function sanitizeHtmlWithLinks(html: string): string {
  if (!html) return ''
  
  // First sanitize the HTML
  let sanitized = DOMPurify.sanitize(html, sanitizeConfig)
  
  // Add rel="noopener noreferrer" to external links
  sanitized = sanitized.replace(
    /<a\s+([^>]*?)href="([^"]*?)"([^>]*?)>/gi,
    (match, before, href, after) => {
      // Check if it's an external link
      if (href.startsWith('http') && !href.includes(window?.location?.hostname || '')) {
        return `<a ${before}href="${href}"${after} target="_blank" rel="noopener noreferrer">`
      }
      return match
    }
  )
  
  return sanitized
}

/**
 * Check if HTML contains any potentially dangerous content
 * @param html - HTML string to check
 * @returns true if HTML is safe, false if potentially dangerous
 */
export function isHtmlSafe(html: string): boolean {
  if (!html) return true
  
  const sanitized = DOMPurify.sanitize(html, sanitizeConfig)
  return sanitized === html
}
