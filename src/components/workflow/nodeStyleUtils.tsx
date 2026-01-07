/**
 * Utility functions for applying node styling and rendering badges
 */

import { WorkflowNodeType } from '@prisma/client'

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

export interface TemplateStyleDefault {
  bgColor?: string | null
  textColor?: string | null
  borderColor?: string | null
}

/**
 * Theme palette definitions
 * Using NHS-aligned colours from Tailwind config
 */
const THEME_PALETTES: Record<
  'info' | 'warning' | 'success' | 'muted' | 'panel',
  { bgColor: string; textColor: string; borderColor: string }
> = {
  info: {
    bgColor: '#E8F4FD', // nhs-light-blue
    textColor: '#003087', // nhs-dark-blue
    borderColor: '#005EB8', // nhs-blue
  },
  warning: {
    bgColor: '#FFF7BF', // nhs-yellow-tint
    textColor: '#425563', // nhs-grey
    borderColor: '#FFB81C', // nhs-yellow
  },
  success: {
    bgColor: '#C8F2E4', // nhs-green-tint
    textColor: '#007F3B', // nhs-green-dark
    borderColor: '#00A499', // nhs-green
  },
  muted: {
    bgColor: '#F0F4F5', // nhs-light-grey
    textColor: '#425563', // nhs-grey
    borderColor: '#425563', // nhs-grey
  },
  panel: {
    bgColor: '#F0F4F5', // nhs-light-grey
    textColor: '#2F3133', // nhs-dark-grey
    borderColor: '#425563', // nhs-grey
  },
}

/**
 * Hard-coded default colours per node type (fallback when no template defaults exist)
 */
const NODE_TYPE_DEFAULTS: Record<WorkflowNodeType, { bgColor: string; textColor: string; borderColor: string }> = {
  INSTRUCTION: {
    bgColor: '#EFF6FF', // blue-50
    textColor: '#1E40AF', // blue-800
    borderColor: '#BFDBFE', // blue-200
  },
  QUESTION: {
    bgColor: '#FFFBEB', // amber-50
    textColor: '#92400E', // amber-800
    borderColor: '#FDE68A', // amber-200
  },
  END: {
    bgColor: '#F0FDF4', // green-50
    textColor: '#166534', // green-800
    borderColor: '#BBF7D0', // green-200
  },
  PANEL: {
    bgColor: '#F9FAFB', // gray-50
    textColor: '#111827', // gray-900
    borderColor: '#E5E7EB', // gray-200
  },
  REFERENCE: {
    bgColor: '#F9FAFB', // gray-50
    textColor: '#111827', // gray-900
    borderColor: '#E5E7EB', // gray-200
  },
}

/**
 * Check if style JSON has explicit color overrides
 * Returns true only if styleJson includes at least one of: backgroundColor/bgColor, textColor, or borderColor
 * Ignores width/height and other keys
 */
export function hasExplicitColorOverrides(styleJson: NodeStyle | null | undefined): boolean {
  if (!styleJson) {
    return false
  }
  
  // Check for explicit color properties (use bgColor only - backgroundColor is legacy)
  // Must be non-empty strings to count as explicit
  const hasBg = styleJson.bgColor !== undefined && styleJson.bgColor !== ''
  const hasText = styleJson.textColor !== undefined && styleJson.textColor !== ''
  const hasBorder = styleJson.borderColor !== undefined && styleJson.borderColor !== ''
  
  return hasBg || hasText || hasBorder
}

/**
 * Alias for backward compatibility
 */
export const hasExplicitStyle = hasExplicitColorOverrides

/**
 * Get effective palette based on precedence rules:
 * 1. If node has explicit color overrides → use those
 * 2. Else if node has theme set (non-default) → apply theme palette
 * 3. Else if template has defaults → apply template defaults
 * 4. Else → apply hard-coded node type defaults
 */
function getEffectivePalette(
  nodeStyle: NodeStyle | null | undefined,
  nodeType: WorkflowNodeType,
  templateDefault: TemplateStyleDefault | null | undefined,
  surgeryDefault: TemplateStyleDefault | null | undefined
): { bgColor?: string; textColor?: string; borderColor?: string } | null {
  // Rule 1: Explicit overrides take precedence
  if (hasExplicitColorOverrides(nodeStyle)) {
    return {
      bgColor: nodeStyle?.bgColor,
      textColor: nodeStyle?.textColor,
      borderColor: nodeStyle?.borderColor,
    }
  }

  // Rule 2: Theme palette (if theme is set and not 'default')
  if (nodeStyle?.theme && nodeStyle.theme !== 'default') {
    const themePalette = THEME_PALETTES[nodeStyle.theme]
    if (themePalette) {
      return themePalette
    }
  }

  // Rule 3: Template defaults
  if (templateDefault) {
    const hasTemplateDefault = templateDefault.bgColor || templateDefault.textColor || templateDefault.borderColor
    if (hasTemplateDefault) {
      return {
        bgColor: templateDefault.bgColor || undefined,
        textColor: templateDefault.textColor || undefined,
        borderColor: templateDefault.borderColor || undefined,
      }
    }
  }

  // Rule 4: Surgery defaults
  if (surgeryDefault) {
    const hasSurgeryDefault = surgeryDefault.bgColor || surgeryDefault.textColor || surgeryDefault.borderColor
    if (hasSurgeryDefault) {
      return {
        bgColor: surgeryDefault.bgColor || undefined,
        textColor: surgeryDefault.textColor || undefined,
        borderColor: surgeryDefault.borderColor || undefined,
      }
    }
  }

  // Rule 5: Hard-coded node type defaults
  return NODE_TYPE_DEFAULTS[nodeType]
}

/**
 * Get inline styles for node rendering
 * Applies effective palette based on precedence rules
 */
export function getNodeStyles(
  style: NodeStyle | null | undefined,
  nodeType: WorkflowNodeType,
  templateDefault?: TemplateStyleDefault | null,
  surgeryDefault?: TemplateStyleDefault | null
): {
  className: string
  style: React.CSSProperties
} {
  const classes: string[] = []
  const inlineStyles: React.CSSProperties = {}

  // Get effective palette
  const effectivePalette = getEffectivePalette(style, nodeType, templateDefault, surgeryDefault)

  // Apply effective palette colors
  if (effectivePalette) {
    if (effectivePalette.bgColor) {
      inlineStyles.backgroundColor = effectivePalette.bgColor
    }
    if (effectivePalette.textColor) {
      inlineStyles.color = effectivePalette.textColor
    }
    if (effectivePalette.borderColor) {
      inlineStyles.borderColor = effectivePalette.borderColor
    }
  }
  
  // Also apply explicit bgColor from style if present (supports both bgColor and backgroundColor)
  if (style?.bgColor) {
    inlineStyles.backgroundColor = style.bgColor
  }
  
  // Also apply explicit textColor from style if present (maps to CSS color property)
  if (style?.textColor) {
    inlineStyles.color = style.textColor
  }

  // Apply explicit overrides for other style properties (always from node style, not palette)
  if (style) {
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
 * Get styling status for UI display
 * Returns: 'customised' | 'theme' | 'defaults'
 */
export function getStylingStatus(
  style: NodeStyle | null | undefined,
  templateDefault: TemplateStyleDefault | null | undefined
): 'customised' | 'theme' | 'defaults' {
  if (hasExplicitColorOverrides(style)) {
    return 'customised'
  }
  if (style?.theme && style.theme !== 'default') {
    return 'theme'
  }
  return 'defaults'
}

/**
 * Get theme display name
 */
export function getThemeDisplayName(theme: string | undefined | null): string {
  if (!theme || theme === 'default') return 'Default'
  const names: Record<string, string> = {
    info: 'Info',
    warning: 'Warning',
    success: 'Success',
    muted: 'Muted',
    panel: 'Panel',
  }
  return names[theme] || theme
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
