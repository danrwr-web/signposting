/**
 * HTML Sanitization Utility
 * Sanitizes HTML content to prevent XSS attacks while preserving formatting
 */

import sanitizeHtmlLib from 'sanitize-html'

const allowedTags = [
    'p', 'br', 'strong', 'em', 'u', 'mark', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'code', 'pre',
    'a'
]

// Server-safe sanitiser (no DOM/JSDOM). This avoids production crashes from DOMPurify/jsdom bundling.
const sanitizeConfig: sanitizeHtmlLib.IOptions = {
  allowedTags,
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'class', 'style'],
    span: ['class', 'style'],
    div: ['class', 'style'],
    p: ['class', 'style'],
    code: ['class'],
    pre: ['class'],
    // Default for all tags:
    '*': ['class', 'style'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  // Only allow a small set of CSS properties we actually use.
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([0-9,\s.]+\)$/, /^[a-zA-Z]+$/],
      'background-color': [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([0-9,\s.]+\)$/, /^[a-zA-Z]+$/],
      'font-weight': [/^(normal|bold|[1-9]00)$/],
      'text-decoration': [/^(none|underline|line-through)$/],
      'text-align': [/^(left|right|center|justify)$/],
    },
  },
  // Always strip dangerous tags/attrs.
  disallowedTagsMode: 'discard',
  allowedIframeHostnames: [],
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

  const sanitized = sanitizeHtmlLib(html, sanitizeConfig)

  // Normalise inline style formatting to be stable and readable.
  // sanitize-html may output compact styles like `color:rgb(255, 0, 0)` (no spaces / no trailing semicolons),
  // which makes string-based tests brittle. We reformat as `color: rgb(...);` consistently.
  return sanitized.replace(/style="([^"]*)"/g, (_match, styleValue: string) => {
    const declarations = styleValue
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((decl) => {
        const idx = decl.indexOf(':')
        if (idx === -1) return decl
        const prop = decl.slice(0, idx).trim()
        const value = decl.slice(idx + 1).trim()
        return `${prop}: ${value};`
      })

    return `style="${declarations.join(' ')}"`
  })
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
  
  // Links are already allowed in our base config; keep this function for clarity/compatibility.
  return sanitizeHtmlLib(html, sanitizeConfig)
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
