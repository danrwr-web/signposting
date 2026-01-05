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
}

/**
 * Get Tailwind classes for a theme preset
 */
function getThemeClasses(theme: NodeStyle['theme']): { bg: string; text: string; border: string } {
  switch (theme) {
    case 'info':
      return { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200' }
    case 'warning':
      return { bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200' }
    case 'success':
      return { bg: 'bg-green-50', text: 'text-green-900', border: 'border-green-200' }
    case 'muted':
      return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
    case 'panel':
      return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' }
    default:
      return { bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-200' }
  }
}

/**
 * Get inline styles for custom colors
 */
export function getNodeStyles(style: NodeStyle | null | undefined): {
  className: string
  style: React.CSSProperties
} {
  if (!style) {
    return { className: '', style: {} }
  }

  const themeClasses = style.theme ? getThemeClasses(style.theme) : null
  const classes: string[] = []
  const inlineStyles: React.CSSProperties = {}

  // Background color
  if (style.bgColor) {
    inlineStyles.backgroundColor = style.bgColor
  } else if (themeClasses) {
    classes.push(themeClasses.bg)
  }

  // Text color
  if (style.textColor) {
    inlineStyles.color = style.textColor
  } else if (themeClasses) {
    classes.push(themeClasses.text)
  }

  // Border color
  if (style.borderColor) {
    inlineStyles.borderColor = style.borderColor
  } else if (themeClasses) {
    classes.push(themeClasses.border)
  }

  // Border width
  if (style.borderWidth !== undefined) {
    inlineStyles.borderWidth = `${style.borderWidth}px`
  }

  // Border radius
  if (style.radius !== undefined) {
    inlineStyles.borderRadius = `${style.radius}px`
  }

  // Font weight
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
