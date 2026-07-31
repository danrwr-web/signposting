/**
 * HTML Sanitization Utility
 * Sanitizes HTML content to prevent XSS attacks while preserving formatting
 *
 * Three allowlists live here:
 * - the base config (`sanitizeHtml`) used by most content — no `img`
 * - the Practice Handbook config (`sanitizeAdminToolkitHtml`) which
 *   additionally allows `img`, but only with a same-origin
 *   `/api/admin-toolkit/images/{id}` src
 * - the symptom config (`sanitizeSymptomHtml`) — same idea, but the only
 *   allowed img src is `/api/symptom-images/{id}`
 * External, protocol-relative and data: image sources are always stripped,
 * and each module's config only accepts its own serving route.
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

// Normalise inline style formatting to be stable and readable.
// sanitize-html may output compact styles like `color:rgb(255, 0, 0)` (no spaces / no trailing semicolons),
// which makes string-based tests brittle. We reformat as `color: rgb(...);` consistently.
function normalizeStyleAttributes(sanitized: string): string {
  return sanitized.replace(/style="([^"]*)"/g, (_match: string, styleValue: string) => {
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
 * Sanitizes HTML content for safe rendering
 * @param html - The HTML content to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  return normalizeStyleAttributes(sanitizeHtmlLib(html, sanitizeConfig))
}

/**
 * The only image src shape handbook content may reference: the authenticated
 * serving route with a cuid id. Anything else — external URLs, data: URIs,
 * other same-origin paths — is stripped by `sanitizeAdminToolkitHtml`.
 */
export const ADMIN_TOOLKIT_IMAGE_SRC_RE = /^\/api\/admin-toolkit\/images\/[a-z0-9]+$/i

/**
 * The only image src shape symptom instructions may reference: the
 * authenticated symptom-image serving route with a cuid id.
 */
export const SYMPTOM_IMAGE_SRC_RE = /^\/api\/symptom-images\/[a-z0-9]+$/i

// Base config plus `img` restricted to one internal serving route.
function makeImageSanitizeConfig(srcRe: RegExp): sanitizeHtmlLib.IOptions {
  return {
    ...sanitizeConfig,
    allowedTags: [...allowedTags, 'img'],
    allowedAttributes: {
      ...sanitizeConfig.allowedAttributes,
      img: ['src', 'alt', 'width'],
    },
    // width must be a plain pixel number (the editor's size presets);
    // anything else — percentages, units, junk — is dropped.
    transformTags: {
      img: (tagName, attribs) => {
        const next = { ...attribs }
        if (next.width !== undefined && !/^\d+$/.test(next.width)) {
          delete next.width
        }
        return { tagName, attribs: next }
      },
    },
    // No scheme'd URLs at all on img (kills http/https/data:). Relative srcs
    // pass this check and are then constrained by the exclusiveFilter below.
    allowedSchemesByTag: { img: [] },
    // Drop any img whose src isn't the internal serving route. Scheme'd srcs
    // have already been removed as attributes by this point, so those images
    // arrive here with no src and are dropped too.
    exclusiveFilter: (frame) =>
      frame.tag === 'img' && !srcRe.test(frame.attribs?.src ?? ''),
  }
}

const adminToolkitSanitizeConfig = makeImageSanitizeConfig(ADMIN_TOOLKIT_IMAGE_SRC_RE)
const symptomSanitizeConfig = makeImageSanitizeConfig(SYMPTOM_IMAGE_SRC_RE)

/**
 * Sanitizes Practice Handbook (Admin Toolkit) HTML. Same allowlist as
 * `sanitizeHtml` plus `img` restricted to internal handbook image URLs.
 */
export function sanitizeAdminToolkitHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  return normalizeStyleAttributes(sanitizeHtmlLib(html, adminToolkitSanitizeConfig))
}

/**
 * Sanitizes symptom instruction HTML. Same allowlist as `sanitizeHtml` plus
 * `img` restricted to internal symptom image URLs — handbook image URLs (or
 * any other src) are stripped.
 */
export function sanitizeSymptomHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  return normalizeStyleAttributes(sanitizeHtmlLib(html, symptomSanitizeConfig))
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
 * Sanitizes the HTML instructions inside a symptom variants object.
 * Shape is validated separately (SymptomVariantsZ in api-contracts); this only
 * cleans the embedded HTML so stored variant content matches the same
 * allowlist as instructionsHtml.
 */
export function sanitizeVariants<T extends { ageGroups: Array<{ instructions: string }> }>(variants: T): T {
  return {
    ...variants,
    ageGroups: variants.ageGroups.map((group) => ({
      ...group,
      instructions: sanitizeSymptomHtml(group.instructions),
    })),
  }
}

/**
 * Strips all HTML and returns plain text suitable for plain-text fields
 * (e.g. the Important Notice / highlightedText, which is edited in a textarea)
 * @param html - The HTML (or plain text) content
 * @returns Plain text with tags removed, entities decoded and whitespace collapsed
 */
export function stripHtmlToPlainText(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  const stripped = sanitizeHtmlLib(html, { allowedTags: [], allowedAttributes: {} })

  // sanitize-html leaves text entity-encoded; decode the common ones so the
  // value reads naturally in plain-text editors.
  const decoded = stripped
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

  // Collapse whitespace runs (including newlines from stripped block tags).
  return decoded.replace(/\s+/g, ' ').trim()
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

/**
 * `sanitizeAndFormatContent` for Practice Handbook regions: same behaviour,
 * but images referencing the internal handbook image route survive.
 */
export function sanitizeAndFormatAdminToolkitContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return ''
  }

  const hasHtmlTags = /<[^>]+>/.test(content)

  if (hasHtmlTags) {
    return sanitizeAdminToolkitHtml(content)
  }
  return sanitizeAdminToolkitHtml(convertLineBreaksToHtml(content))
}

/**
 * `sanitizeAndFormatContent` for symptom instruction regions: same behaviour,
 * but images referencing the internal symptom image route survive.
 */
export function sanitizeAndFormatSymptomContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return ''
  }

  const hasHtmlTags = /<[^>]+>/.test(content)

  if (hasHtmlTags) {
    return sanitizeSymptomHtml(content)
  }
  return sanitizeSymptomHtml(convertLineBreaksToHtml(content))
}
