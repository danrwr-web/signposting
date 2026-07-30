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
  [/\b(dark\s*blue|navy)\b/, 'bg-blue-900 text-white'],
  [/\b((pale|light|sky)\s*blue)\b/, 'bg-sky-300 text-sky-950'],
  [/\broyal\s*blue\b/, 'bg-blue-700 text-white'],
  [/\b(dark\s*green|forest\s*green)\b/, 'bg-green-800 text-white'],
  [/\b(lime(\s*green)?|(light|pale)\s*green)\b/, 'bg-lime-400 text-lime-950'],
  [/\b(dark\s*red|maroon|burgundy)\b/, 'bg-red-900 text-white'],
  [/\b(dark\s*(grey|gray)|charcoal)\b/, 'bg-gray-700 text-white'],
  [/\b(light\s*(grey|gray)|silver)\b/, 'bg-gray-300 text-gray-800'],
  [/\bblack\b/, 'bg-gray-900 text-white'],
  [/\bwhite\b/, 'bg-white text-gray-800 border border-gray-300'],
  [/\b(grey|gray)\b/, 'bg-gray-500 text-white'],
  [/\bred\b/, 'bg-red-600 text-white'],
  [/\bpink\b/, 'bg-pink-500 text-white'],
  [/\b(purple|violet|lilac)\b/, 'bg-purple-600 text-white'],
  [/\borange\b/, 'bg-orange-500 text-white'],
  [/\b(amber|gold)\b/, 'bg-amber-500 text-amber-950'],
  [/\byellow\b/, 'bg-yellow-400 text-yellow-950'],
  [/\b(teal|turquoise|aqua|cyan)\b/, 'bg-teal-600 text-white'],
  [/\bgreen\b/, 'bg-green-600 text-white'],
  [/\bblue\b/, 'bg-blue-600 text-white'],
  [/\bbrown\b/, 'bg-amber-800 text-white'],
]

export function namedColourChipClass(text: string): string | null {
  const lower = text.toLowerCase()
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
