/**
 * Client-side highlighting utilities
 * Pure functions that work with highlight rules data
 */

import { escapeHtml } from './escapeHtml'

export interface HighlightRule {
  id: string
  phrase: string
  textColor: string
  bgColor: string
  isEnabled: boolean
  createdAt: string | Date
  updatedAt: string | Date
}

/**
 * Apply highlighting rules to text
 * Returns HTML string with highlighting applied
 */
export function applyHighlightRules(
  text: string,
  rules: Array<{ phrase: string; textColor: string; bgColor: string; isEnabled: boolean }>,
  enableBuiltInHighlights: boolean = true
): string {
  let highlightedText = applyCustomRules(text, rules)

  if (enableBuiltInHighlights) {
    highlightedText = applyBuiltInHighlighting(highlightedText)
  }

  return highlightedText
}

/**
 * Highlight a **plain-text** field and return HTML that is safe to render.
 *
 * `applyHighlightRules` passes its input through verbatim — it is an HTML
 * transform, so anything tag-shaped in the input stays tag-shaped in the
 * output. Fields like `briefInstruction` and `highlightedText` are authored in
 * plain `<input>`/`<textarea>` controls and are never meant to carry markup,
 * so we escape them first: markup an author typed (or pasted, or injected)
 * renders as literal text instead of executing.
 *
 * Rule phrases are escaped alongside the text. Escaping rewrites the string
 * the phrase matcher scans, so a rule for a phrase containing `&`, `<` or `>`
 * — "A&E" being the obvious NHS example — would otherwise silently stop
 * matching. Escaping both sides keeps them in the same alphabet.
 *
 * (Consequence of matching post-escape: a rule whose phrase is literally an
 * entity name — "amp", "lt", "gt" — can match inside an escaped entity and
 * split it, which displays that one entity oddly. Harmless and inert; not
 * worth reimplementing the pipeline to avoid.)
 */
export function highlightPlainText(
  text: string | null | undefined,
  rules: Array<{ phrase: string; textColor: string; bgColor: string; isEnabled: boolean }>,
  enableBuiltInHighlights: boolean = true
): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  const escapedRules = Array.isArray(rules)
    ? rules.map(rule => ({ ...rule, phrase: escapeHtml(rule.phrase) }))
    : []

  return applyHighlightRules(escapeHtml(text), escapedRules, enableBuiltInHighlights)
}

/**
 * Split HTML into alternating text and tag tokens and transform only the
 * text tokens, so replacements can never corrupt tag internals (attribute
 * values such as alt="…", src="…" or style="…"). spanDepth tells the
 * transform whether the text sits inside a <span> that an earlier pass
 * created, so built-in highlighting can avoid double-wrapping.
 */
function mapTextSegments(
  html: string,
  transform: (segment: string, spanDepth: number) => string
): string {
  const tokens = html.split(/(<[^>]+>)/)
  let spanDepth = 0
  return tokens
    .map(token => {
      if (token.startsWith('<') && token.endsWith('>')) {
        if (/^<span[\s>]/i.test(token)) {
          spanDepth++
        } else if (/^<\/span>$/i.test(token)) {
          spanDepth = Math.max(0, spanDepth - 1)
        }
        return token
      }
      if (token === '') return token
      return transform(token, spanDepth)
    })
    .join('')
}

/**
 * Apply built-in slot type highlighting
 */
function applyBuiltInHighlighting(text: string): string {
  text = wrapBuiltInHighlight(
    text,
    /(green slot)/gi,
    'bg-green-600 text-white px-1 py-0.5 rounded text-sm font-medium'
  )

  text = wrapBuiltInHighlight(
    text,
    /(orange slot)/gi,
    'bg-orange-600 text-white px-1 py-0.5 rounded text-sm font-medium'
  )

  text = wrapBuiltInHighlight(
    text,
    /(red slot)/gi,
    'bg-red-600 text-white px-1 py-0.5 rounded text-sm font-medium'
  )

  text = wrapBuiltInHighlight(
    text,
    /(pink|purple)/gi,
    'bg-purple-600 text-white px-1 py-0.5 rounded text-sm font-medium'
  )

  return text
}

/**
 * Apply custom highlight rules
 * Custom rules take precedence over built-in keywords
 */
function applyCustomRules(
  text: string, 
  rules: Array<{ phrase: string; textColor: string; bgColor: string; isEnabled: boolean }>
): string {
  // Ensure rules is an array
  if (!Array.isArray(rules)) {
    return text
  }
  
  // Filter enabled rules and sort by creation order
  const enabledRules = rules.filter(rule => rule.isEnabled)

  for (const rule of enabledRules) {
    const { phrase, textColor, bgColor } = rule

    if (!phrase) {
      continue
    }

    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const requiresWordBoundary = /^[\p{L}\p{N}\s]+$/u.test(phrase)
    const pattern = requiresWordBoundary ? `\\b${escapedPhrase}\\b` : escapedPhrase
    const regex = new RegExp(pattern, 'gi')

    // Re-tokenize per rule so a phrase can still match text this or an
    // earlier rule wrapped, but never a tag's attributes.
    text = mapTextSegments(text, segment =>
      segment.replace(regex, (match) => {
        return `<span style="color: ${textColor}; background-color: ${bgColor}; padding: 2px 4px; border-radius: 4px; font-weight: 500;" class="text-sm">${match}</span>`
      })
    )
  }

  return text
}

function wrapBuiltInHighlight(text: string, regex: RegExp, className: string): string {
  // Skip text already inside a <span> (a custom rule or an earlier built-in
  // pattern claimed it) and never touch tag internals.
  return mapTextSegments(text, (segment, spanDepth) => {
    if (spanDepth > 0) return segment
    return segment.replace(regex, (match) => `<span class="${className}">${match}</span>`)
  })
}
