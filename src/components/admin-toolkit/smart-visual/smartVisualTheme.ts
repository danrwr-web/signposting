import type { SmartVisualTheme } from '@/lib/adminToolkitSmartVisualShared'

/**
 * Tailwind class triples for the constrained smart-visual theme enum,
 * following the THEME_PALETTES pattern in src/components/workflow/nodeStyleUtils.tsx.
 */
export const SECTION_THEMES: Record<
  SmartVisualTheme,
  { surface: string; border: string; heading: string; icon: string; accent: string; chip: string }
> = {
  blue: {
    surface: 'bg-blue-50',
    border: 'border-blue-200',
    heading: 'text-nhs-dark-blue',
    icon: 'text-nhs-blue',
    accent: 'bg-nhs-blue',
    chip: 'bg-nhs-blue text-white',
  },
  green: {
    surface: 'bg-emerald-50',
    border: 'border-emerald-200',
    heading: 'text-nhs-green-dark',
    icon: 'text-nhs-green-dark',
    accent: 'bg-nhs-green',
    chip: 'bg-nhs-green-dark text-white',
  },
  amber: {
    surface: 'bg-amber-50',
    border: 'border-amber-200',
    heading: 'text-amber-900',
    icon: 'text-amber-600',
    accent: 'bg-nhs-yellow',
    chip: 'bg-amber-400 text-amber-950',
  },
  red: {
    surface: 'bg-red-50',
    border: 'border-red-200',
    heading: 'text-nhs-red-dark',
    icon: 'text-nhs-red',
    accent: 'bg-nhs-red',
    chip: 'bg-nhs-red text-white',
  },
  grey: {
    surface: 'bg-gray-50',
    border: 'border-gray-200',
    heading: 'text-nhs-dark-grey',
    icon: 'text-nhs-grey',
    accent: 'bg-nhs-grey',
    chip: 'bg-nhs-grey text-white',
  },
}

/**
 * Rotation used to auto-theme parallel groups the AI left unthemed, so
 * adjacent groups stay visually distinct. Red is excluded — it is reserved
 * for urgent content and must be chosen deliberately.
 */
export const GROUP_THEME_CYCLE: SmartVisualTheme[] = ['blue', 'green', 'amber', 'grey']

/**
 * Deterministic colour-word → chip-style mapping for member tags, so a tag
 * like "Lime Green" or "Pale Blue" renders in that colour. Longest phrases
 * are matched first ("dark blue" before "blue"). All styles come from this
 * fixed, contrast-checked palette — the AI never supplies styling. Returns
 * null when the tag contains no recognised colour word.
 */
const NAMED_COLOUR_CHIPS: Array<[RegExp, string]> = [
  [/dark\s*blue|navy/, 'bg-blue-900 text-white'],
  [/pale\s*blue|light\s*blue|sky\s*blue/, 'bg-sky-300 text-sky-950'],
  [/royal\s*blue/, 'bg-blue-700 text-white'],
  [/dark\s*green|forest/, 'bg-green-800 text-white'],
  [/lime(\s*green)?|light\s*green|pale\s*green/, 'bg-lime-400 text-lime-950'],
  [/dark\s*red|maroon|burgundy/, 'bg-red-900 text-white'],
  [/dark\s*grey|dark\s*gray|charcoal/, 'bg-gray-700 text-white'],
  [/light\s*grey|light\s*gray|silver/, 'bg-gray-300 text-gray-800'],
  [/black/, 'bg-gray-900 text-white'],
  [/white/, 'bg-white text-gray-800 border border-gray-300'],
  [/grey|gray/, 'bg-gray-500 text-white'],
  [/red/, 'bg-red-600 text-white'],
  [/pink/, 'bg-pink-500 text-white'],
  [/purple|violet|lilac/, 'bg-purple-600 text-white'],
  [/orange/, 'bg-orange-500 text-white'],
  [/amber|gold/, 'bg-amber-500 text-amber-950'],
  [/yellow/, 'bg-yellow-400 text-yellow-950'],
  [/teal|turquoise|aqua|cyan/, 'bg-teal-600 text-white'],
  [/green/, 'bg-green-600 text-white'],
  [/blue/, 'bg-blue-600 text-white'],
  [/brown/, 'bg-amber-800 text-white'],
]

export function namedColourChipClass(tag: string): string | null {
  const lower = tag.toLowerCase()
  for (const [pattern, classes] of NAMED_COLOUR_CHIPS) {
    if (pattern.test(lower)) return classes
  }
  return null
}

export const DEFAULT_THEME: SmartVisualTheme = 'blue'

/** Callout tone → theme + emphasis used by the CalloutSection. */
export const CALLOUT_TONE_THEMES: Record<'info' | 'warning' | 'urgent' | 'success', SmartVisualTheme> = {
  info: 'blue',
  warning: 'amber',
  urgent: 'red',
  success: 'green',
}
