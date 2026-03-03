import type { DriveStep, Side } from 'driver.js'

export interface TourStepConfig {
  id: string
  element?: string // CSS selector — omit for centered popover
  title: string
  description: string
  side?: Side
  /** When true, step is skipped if the target element is not in the DOM */
  requiresElement?: boolean
  /** Marks the step as the cross-page transition point */
  isPageTransition?: boolean
  /** Prevent the user from clicking the highlighted element */
  disableActiveInteraction?: boolean
}

// ---------------------------------------------------------------------------
// Onboarding tour — Page 1: Signposting listing (/s/[id])
// ---------------------------------------------------------------------------

export const ONBOARDING_PAGE1_STEPS: TourStepConfig[] = [
  {
    id: 'search',
    element: '[data-tour="search-box"]',
    title: 'Search for symptoms',
    description:
      'Type a symptom name here to quickly find the right guidance. You can also press / on your keyboard to jump straight to search.',
    side: 'bottom',
  },
  {
    id: 'age-filter',
    element: '[data-tour="age-filter"]',
    title: 'Filter by age group',
    description:
      'Use these tabs to show guidance for Under 5s, children aged 5–17, or adults. Each age group may have different instructions.',
    side: 'bottom',
  },
  {
    id: 'high-risk',
    element: '[data-tour="high-risk-buttons"]',
    title: 'High-risk shortcuts',
    description:
      'These red buttons give you instant access to the most urgent conditions like Anaphylaxis and Stroke.',
    side: 'bottom',
    requiresElement: true,
  },
  {
    id: 'symptom-card',
    element: '[data-tour="symptom-card"]',
    title: 'Symptom cards',
    description:
      'Each card shows the symptom name, age group, and a brief instruction. Click Next to open this card and see the full guidance.',
    side: 'bottom',
    requiresElement: true,
    isPageTransition: true,
    disableActiveInteraction: true,
  },
  {
    id: 'alphabet',
    element: '[data-tour="alphabet-strip"]',
    title: 'A\u2013Z navigation',
    description:
      'Jump to symptoms starting with a specific letter. Useful when you know the symptom name.',
    side: 'top',
    requiresElement: true,
  },
]

// ---------------------------------------------------------------------------
// Onboarding tour — Page 2: Symptom detail (/symptom/[id])
// ---------------------------------------------------------------------------

export const ONBOARDING_PAGE2_STEPS: TourStepConfig[] = [
  {
    id: 'symptom-title',
    element: '[data-tour="symptom-title"]',
    title: 'Symptom detail',
    description:
      'Here you see the full clinically-approved guidance for this symptom, including a brief overview at the top.',
    side: 'bottom',
  },
  {
    id: 'highlighted-text',
    element: '[data-tour="highlighted-text"]',
    title: 'Important notices',
    description:
      'Key safety information is shown in red. Always check these notices first when triaging a call.',
    side: 'bottom',
    requiresElement: true,
  },
  {
    id: 'variant-selector',
    element: '[data-tour="variant-selector"]',
    title: 'Age-specific advice',
    description:
      'Some symptoms have different instructions by age group. Select a group to see tailored guidance.',
    side: 'bottom',
    requiresElement: true,
  },
  {
    id: 'instructions-body',
    element: '[data-tour="instructions-body"]',
    title: 'Colour highlights',
    description:
      'Key phrases are automatically highlighted in the instructions. Your practice can customise which phrases are highlighted and in what colours.',
    side: 'top',
  },
  {
    id: 'nav-trigger',
    element: '[data-tour="nav-trigger"]',
    title: 'Navigation menu',
    description:
      'Switch between Signposting, Appointments, and more. You can also restart this tour from the menu at any time.',
    side: 'right',
  },
]

// ---------------------------------------------------------------------------
// Demo tour — Page 1: Signposting listing (reordered for impact)
// ---------------------------------------------------------------------------

export const DEMO_PAGE1_STEPS: TourStepConfig[] = [
  {
    id: 'demo-high-risk',
    element: '[data-tour="high-risk-buttons"]',
    title: 'Instant access to critical conditions',
    description:
      'High-risk shortcuts let reception staff immediately find guidance for urgent conditions like Anaphylaxis, Stroke, and Chest Pain.',
    side: 'bottom',
    requiresElement: true,
  },
  {
    id: 'demo-symptom-card',
    element: '[data-tour="symptom-card"]',
    title: 'Clinically-approved guidance',
    description:
      'Every symptom card contains brief, clinically-approved instructions. Click Next to see a full example.',
    side: 'bottom',
    requiresElement: true,
    isPageTransition: true,
    disableActiveInteraction: true,
  },
  {
    id: 'demo-search',
    element: '[data-tour="search-box"]',
    title: 'Find any symptom in seconds',
    description:
      'A fast search bar helps staff find the right guidance quickly, even during busy call periods.',
    side: 'bottom',
  },
  {
    id: 'demo-age-filter',
    element: '[data-tour="age-filter"]',
    title: 'Age-specific care pathways',
    description:
      'Guidance is tailored by age group — Under 5, 5–17, and Adult — ensuring patients get age-appropriate care.',
    side: 'bottom',
  },
]

// ---------------------------------------------------------------------------
// Demo tour — Page 2: Symptom detail
// ---------------------------------------------------------------------------

export const DEMO_PAGE2_STEPS: TourStepConfig[] = [
  {
    id: 'demo-symptom-detail',
    element: '[data-tour="symptom-title"]',
    title: 'Full clinical guidance',
    description:
      'Each symptom has a dedicated page with comprehensive, clinically-reviewed instructions for your reception team.',
    side: 'bottom',
  },
  {
    id: 'demo-highlights',
    element: '[data-tour="instructions-body"]',
    title: 'Colour-coded safety highlights',
    description:
      'Key phrases are automatically highlighted. Your practice can customise highlight rules and colours.',
    side: 'top',
  },
  {
    id: 'demo-variants',
    element: '[data-tour="variant-selector"]',
    title: 'Age-specific instruction pathways',
    description:
      'Different age groups receive different clinical advice, ensuring every patient gets the right guidance.',
    side: 'bottom',
    requiresElement: true,
  },
  {
    id: 'demo-nav',
    element: '[data-tour="nav-trigger"]',
    title: 'Multiple integrated modules',
    description:
      'Beyond Signposting, the toolkit includes Appointments Directory, Practice Handbook, and Workflow Guidance — all from one menu.',
    side: 'right',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Filter steps to only those whose target element exists in the DOM */
export function filterVisibleSteps(steps: TourStepConfig[]): TourStepConfig[] {
  return steps.filter((step) => {
    if (!step.element) return true
    if (!step.requiresElement) return true
    return document.querySelector(step.element) !== null
  })
}

/** Convert our step configs to Driver.js DriveStep format */
export function toDriverSteps(
  steps: TourStepConfig[],
  totalSteps: number,
  stepOffset: number
): DriveStep[] {
  return steps.map((step, i) => ({
    element: step.element,
    ...(step.disableActiveInteraction
      ? { disableActiveInteraction: true }
      : {}),
    popover: {
      title: step.title,
      description: step.description,
      side: step.side,
      popoverClass: 'tour-popover-nhs',
      progressText: `${stepOffset + i + 1} of ${totalSteps}`,
    },
  }))
}
