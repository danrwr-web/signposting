/**
 * Utility functions for applying node styling and rendering badges
 */

export interface NodeStyle {
  bgColor?: string
  textColor?: string
  borderColor?: string
  borderWidth?: number
  radius?: number
  fontWeight?: 'normal' | 'medium' | 'bold'
  theme?: 'default' | 'info' | 'warning' | 'success' | 'muted' | 'panel'
  width?: number
  height?: number
}

/**
 * Check if style JSON has explicit color overrides
 * Returns true only if styleJson includes at least one of: backgroundColor/bgColor, textColor, or borderColor
 * Ignores width/height and other keys
 */
export function hasExplicitStyle(styleJson: NodeStyle | null | undefined): boolean {
  if (!styleJson) {
    return false
  }
  
  // Check for explicit color properties (support both backgroundColor and bgColor)
  return (styleJson.backgroundColor !== undefined || styleJson.bgColor !== undefined) ||
         styleJson.textColor !== undefined ||
         styleJson.borderColor !== undefined
}

/**
 * Get inline styles for custom colors
 * Only applies styles if node has explicit style overrides (bgColor/backgroundColor, textColor, or borderColor)
 * Returns empty styles for nodes without explicit overrides to preserve original appearance
 * Does NOT inject theme defaults for missing keys
 */
export function getNodeStyles(style: NodeStyle | null | undefined): {
  className: string
  style: React.CSSProperties
} {
  if (!style) {
    return { className: '', style: {} }
  }

  // Only apply styles if at least one explicit color property is set
  if (!hasExplicitStyle(style)) {
    // No explicit style overrides - return empty to preserve original node styling
    return { className: '', style: {} }
  }

  const classes: string[] = []
  const inlineStyles: React.CSSProperties = {}

  // Background color - prefer backgroundColor, fallback to bgColor
  if (style.backgroundColor !== undefined) {
    inlineStyles.backgroundColor = style.backgroundColor
  } else if (style.bgColor !== undefined) {
    inlineStyles.backgroundColor = style.bgColor
  }
  // Do NOT inject theme defaults for missing keys

  // Text color - only if explicitly set
  if (style.textColor !== undefined) {
    inlineStyles.color = style.textColor
  }
  // Do NOT inject theme defaults for missing keys

  // Border color - only if explicitly set
  if (style.borderColor !== undefined) {
    inlineStyles.borderColor = style.borderColor
  }
  // Do NOT inject theme defaults for missing keys

  // Border width - only if explicitly set
  if (style.borderWidth !== undefined) {
    inlineStyles.borderWidth = `${style.borderWidth}px`
  }

  // Border radius - only if explicitly set
  if (style.radius !== undefined) {
    inlineStyles.borderRadius = `${style.radius}px`
  }

  // Font weight - only if explicitly set
  if (style.fontWeight) {
    switch (style.fontWeight) {
      case 'bold':
        classes.push('font-bold')
        break
      case 'medium':
        classes.push('font-medium')
        break
      case 'normal':
        classes.push('font-normal')
        break
    }
  }

  return {
    className: classes.join(' '),
    style: inlineStyles,
  }
}

/**
 * Get badge styling for a specific badge type
 */
export function getBadgeStyles(badge: string): { bg: string; text: string } {
  switch (badge.toUpperCase()) {
    case 'STAMP':
      return { bg: 'bg-red-600', text: 'text-white' }
    default:
      return { bg: 'bg-gray-600', text: 'text-white' }
  }
}

/**
 * Render badges as pills
 */
export function renderBadges(badges: string[]): React.ReactNode {
  if (!badges || badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge, index) => {
        const styles = getBadgeStyles(badge)
        return (
          <span
            key={index}
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles.bg} ${styles.text}`}
          >
            {badge}
          </span>
        )
      })}
    </div>
  )
}
