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
 * Converts single paragraph content to multiple paragraphs based on medical instruction patterns
 * This helps fix existing content that was stored as single paragraphs
 * @param html - The HTML content to process
 * @returns HTML with proper paragraph breaks
 */
export function convertSingleParagraphToMultiple(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }
  
  // Only process if it's a single paragraph
  if (!html.match(/^<p>.*<\/p>$/s)) {
    return html
  }
  
  // Extract content from paragraph tags
  const content = html.replace(/^<p>(.*)<\/p>$/s, '$1')
  
  // Medical instruction patterns that typically indicate paragraph breaks:
  // 1. "Signpost Community Pharmacy" - common instruction separator
  // 2. "Contact GP" - another common instruction separator  
  // 3. "Call 111" - emergency instruction separator
  // 4. "Go to A&E" - emergency instruction separator
  // 5. Colon followed by space and capital letter (e.g., "Symptoms: Treatment")
  
  let processedContent = content
  
  // Split on common medical instruction patterns
  const instructionPatterns = [
    /(Signpost Community Pharmacy)/gi,
    /(Contact GP)/gi,
    /(Call 111)/gi,
    /(Go to A&E)/gi,
    /(Visit A&E)/gi,
    /(Emergency Department)/gi,
  ]
  
  // Apply instruction pattern splits
  instructionPatterns.forEach(pattern => {
    processedContent = processedContent.replace(pattern, '</p><p>$1')
  })
  
  // Also split on colon patterns for general instruction separation
  processedContent = processedContent.replace(/:\s+([A-Z][^:]*?)(?=\s+[A-Z]|$)/g, ':</p><p>$1')
  
  // Clean up any double paragraph tags
  processedContent = processedContent.replace(/<\/p><p><\/p><p>/g, '</p><p>')
  processedContent = processedContent.replace(/^<\/p><p>/, '')
  processedContent = processedContent.replace(/<\/p><p>$/, '')
  
  // If we made changes, wrap in paragraph tags
  if (processedContent !== content) {
    return `<p>${processedContent}</p>`
  }
  
  // If no changes were made, return original
  return html
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
    // Content is already HTML, try to fix single paragraphs
    const fixedContent = convertSingleParagraphToMultiple(content)
    return sanitizeHtml(fixedContent)
  } else {
    // Content is plain text, convert line breaks and sanitize
    const htmlWithBreaks = convertLineBreaksToHtml(content)
    return sanitizeHtml(htmlWithBreaks)
  }
}
