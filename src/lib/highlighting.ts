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
  rules: Array<{ phrase: string; textColor: string; bgColor: string; isEnabled: boolean }>
): string {
  let highlightedText = text

  // Apply built-in slot highlighting first
  highlightedText = applyBuiltInHighlighting(highlightedText)

  // Apply custom rules (they take precedence)
  highlightedText = applyCustomRules(highlightedText, rules)

  return highlightedText
}

/**
 * Apply built-in slot type highlighting
 */
function applyBuiltInHighlighting(text: string): string {
  // Highlight green slots
  text = text.replace(/(green slot)/gi, '<span class="bg-green-600 text-white px-1 py-0.5 rounded text-sm font-medium">$1</span>')
  
  // Highlight orange slots
  text = text.replace(/(orange slot)/gi, '<span class="bg-orange-600 text-white px-1 py-0.5 rounded text-sm font-medium">$1</span>')
  
  // Highlight red slots
  text = text.replace(/(red slot)/gi, '<span class="bg-red-600 text-white px-1 py-0.5 rounded text-sm font-medium">$1</span>')
  
  // Highlight pink/purple keywords (case-insensitive)
  text = text.replace(/(pink|purple)/gi, '<span class="bg-purple-600 text-white px-1 py-0.5 rounded text-sm font-medium">$1</span>')
  
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
    
    // Escape special regex characters in phrase
    const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    
    // Create regex pattern (case-insensitive, word boundaries)
    const regex = new RegExp(`\\b${escapedPhrase}\\b`, 'gi')
    
    // Replace with styled span
    text = text.replace(regex, (match) => {
      return `<span style="color: ${textColor}; background-color: ${bgColor}; padding: 2px 4px; border-radius: 4px; font-weight: 500;" class="text-sm">${match}</span>`
    })
  }

  return text
}
