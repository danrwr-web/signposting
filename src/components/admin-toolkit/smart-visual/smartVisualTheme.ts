import type { SmartVisualTheme } from '@/lib/adminToolkitSmartVisualShared'

/**
 * Tailwind class triples for the constrained smart-visual theme enum,
 * following the THEME_PALETTES pattern in src/components/workflow/nodeStyleUtils.tsx.
 */
export const SECTION_THEMES: Record<
  SmartVisualTheme,
  { surface: string; border: string; heading: string; icon: string; accent: string }
> = {
  blue: {
    surface: 'bg-blue-50',
    border: 'border-blue-200',
    heading: 'text-nhs-dark-blue',
    icon: 'text-nhs-blue',
    accent: 'bg-nhs-blue',
  },
  green: {
    surface: 'bg-emerald-50',
    border: 'border-emerald-200',
    heading: 'text-nhs-green-dark',
    icon: 'text-nhs-green-dark',
    accent: 'bg-nhs-green',
  },
  amber: {
    surface: 'bg-amber-50',
    border: 'border-amber-200',
    heading: 'text-amber-900',
    icon: 'text-amber-600',
    accent: 'bg-nhs-yellow',
  },
  red: {
    surface: 'bg-red-50',
    border: 'border-red-200',
    heading: 'text-nhs-red-dark',
    icon: 'text-nhs-red',
    accent: 'bg-nhs-red',
  },
  grey: {
    surface: 'bg-gray-50',
    border: 'border-gray-200',
    heading: 'text-nhs-dark-grey',
    icon: 'text-nhs-grey',
    accent: 'bg-nhs-grey',
  },
}

export const DEFAULT_THEME: SmartVisualTheme = 'blue'

/** Callout tone → theme + emphasis used by the CalloutSection. */
export const CALLOUT_TONE_THEMES: Record<'info' | 'warning' | 'urgent' | 'success', SmartVisualTheme> = {
  info: 'blue',
  warning: 'amber',
  urgent: 'red',
  success: 'green',
}
