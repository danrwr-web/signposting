/**
 * Client-side highlighting utilities
 * Pure functions that work with highlight rules data
 */

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

    text = text.replace(regex, (match) => {
      return `<span style="color: ${textColor}; background-color: ${bgColor}; padding: 2px 4px; border-radius: 4px; font-weight: 500;" class="text-sm">${match}</span>`
    })
  }

  return text
}

function wrapBuiltInHighlight(text: string, regex: RegExp, className: string): string {
  return text.replace(regex, (match, _group, offset: number, original: string) => {
    if (isInsideSpan(original, offset)) {
      return match
    }
    return `<span class="${className}">${match}</span>`
  })
}

function isInsideSpan(source: string, index: number): boolean {
  const openIndex = source.lastIndexOf('<span', index)
  if (openIndex === -1) {
    return false
  }

  const openEnd = source.indexOf('>', openIndex)
  if (openEnd === -1 || openEnd > index) {
    return false
  }

  const closeIndex = source.indexOf('</span>', openEnd)
  if (closeIndex === -1) {
    return false
  }

  return closeIndex > index
}
