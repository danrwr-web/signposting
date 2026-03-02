import { z } from 'zod'
import { EditorialLearningCardZ } from '@/lib/schemas/editorial'
import { ADMIN_TOOLKIT_SOURCE_BASE_URL, ADMIN_TOOLKIT_SOURCE_TITLE } from '@/lib/editorial/toolkitSources'

type EditorialLearningCard = z.infer<typeof EditorialLearningCardZ>

export type AdminValidationIssue = {
  code: 'FORBIDDEN_PATTERN' | 'FORBIDDEN_SOURCE' | 'MISSING_SLOT_GUIDANCE' | 'MISSING_TOOLKIT_SOURCE'
  message: string
  cardTitle?: string
}

// Each entry has:
//   pattern  — the regex to test for the forbidden concept
//   label    — human-readable name used in the issue message
//   strip    — optional regexes to remove safe/negative uses BEFORE testing
//              so that "do not prescribe medication" or "self-diagnosis" don't fire
const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; label: string; strip?: RegExp[] }> = [
  {
    // Clinical risk-scoring tools — always forbidden for receptionist cards
    pattern: /protective factors/i,
    label: 'protective factors',
  },
  {
    pattern: /sigecaps/i,
    label: 'SIGECAPS',
  },
  {
    pattern: /phq-9/i,
    label: 'PHQ-9',
  },
  {
    pattern: /gad-7/i,
    label: 'GAD-7',
  },
  {
    pattern: /columbia/i,
    label: 'Columbia',
  },
  {
    // "diagnose/diagnosis" — strip self-diagnosis and negative instructions before testing.
    // This mirrors the strip logic in editorialAi.ts so the two checks agree.
    pattern: /\bdiagnos(e|is|ed|ing)\b/i,
    label: 'diagnose/diagnosis',
    strip: [
      /self-diagnos\w*/gi,
      /\b(no|not|avoid|without|never|don'?t|do not)\s+diagnos\w*/gi,
    ],
  },
  {
    pattern: /\bdifferential(s)?\b/i,
    label: 'differential diagnosis',
  },
  {
    // "titrate" — only forbidden as an instruction; strip "do not titrate" etc.
    pattern: /titrat\w*/i,
    label: 'titrate/titration',
    strip: [
      /\b(no|not|avoid|never|don'?t|do not)\s+titrat\w*/gi,
    ],
  },
  {
    // "medication" — receptionist cards may legitimately say "ask about current medication"
    // or "do not advise on medication". Strip those safe forms; only flag prescribing language.
    pattern: /\bmedication\b/i,
    label: 'medication (prescribing context)',
    strip: [
      // Negative instructions: "do not prescribe/change/adjust/advise on medication"
      /\b(do not|don'?t|never|avoid|not)\s+\w*\s*(prescrib\w*|adjust\w*|chang\w*|alter\w*|advis\w*\s+on)\s+medication\w*/gi,
      // Patient history references: "current medication", "existing medication", "their medication"
      /\b(current|existing|regular|repeat|prescribed|patient'?s?|their|any)\s+medication\w*/gi,
      // Asking about: "ask about medication", "enquire about medication"
      /\b(ask|enquire|check|note|record)\s+(about|regarding|on)\s+medication\w*/gi,
      // "medication history"
      /medication\s+histor\w*/gi,
      // "medication list"
      /medication\s+list\w*/gi,
    ],
  },
  {
    // "risk assessment" — strip "this is not a risk assessment" / "do not conduct a risk assessment"
    pattern: /risk assessment/i,
    label: 'risk assessment (clinical)',
    strip: [
      /\b(this is not|not a|no|avoid|do not|don'?t|never)\s+(a\s+|conduct\s+a?\s+|perform\s+a?\s+)?risk assessment/gi,
    ],
  },
  // Note: RCGP is checked separately as a source URL check below — not duplicated here
]

const TRIAGE_TERMS = [
  'triage',
  'slot',
  'same-day',
  'same day',
  'urgent',
  'red',
  'orange',
  'pink',
  'purple',
  'green',
  'escalat',
  '999',
  '111',
  'duty gp',
  'same-day clinician',
  'handover',
  'signposting',
]

function hasTriageSignals(input: string) {
  const lower = input.toLowerCase()
  return TRIAGE_TERMS.some((term) => lower.includes(term))
}

function combineCardText(card: EditorialLearningCard) {
  const blocks = card.contentBlocks
    .map((block) => {
      if (block.type === 'text' || block.type === 'callout') {
        return block.text
      }
      return block.items.join(' ')
    })
    .join(' ')
  const interactions = card.interactions
    .map((interaction) => [interaction.question, interaction.options.join(' '), interaction.explanation].join(' '))
    .join(' ')
  const slotGuidance = card.slotLanguage.guidance.map((item) => `${item.slot} ${item.rule}`).join(' ')
  const sources = card.sources.map((source) => `${source.title} ${source.url}`).join(' ')
  return [
    card.title,
    blocks,
    interactions,
    slotGuidance,
    card.safetyNetting.join(' '),
    sources,
  ].join(' ')
}

export function validateAdminCards(params: {
  cards: EditorialLearningCard[]
  promptText: string
}): AdminValidationIssue[] {
  const issues: AdminValidationIssue[] = []
  const promptHasTriageSignals = hasTriageSignals(params.promptText)

  params.cards.forEach((card) => {
    const combined = combineCardText(card)

    FORBIDDEN_PATTERNS.forEach(({ pattern, label, strip }) => {
      // Strip known-safe negative/contextual forms before testing so that phrases
      // like "do not prescribe medication" or "this is not a risk assessment" don't fire.
      const testText = strip
        ? strip.reduce((text, stripPattern) => text.replace(stripPattern, ''), combined)
        : combined

      if (pattern.test(testText)) {
        issues.push({
          code: 'FORBIDDEN_PATTERN',
          message: `Forbidden content detected: ${label}`,
          cardTitle: card.title,
        })
      }
    })

    const primarySource = card.sources[0]
    // Accept toolkit source with either:
    // 1. Title is exactly ADMIN_TOOLKIT_SOURCE_TITLE ("Signposting Toolkit (internal)")
    // 2. Title starts with "Signposting Toolkit" (for surgery-specific: "Signposting Toolkit (Surgery Name)")
    // URL can be null (DB-driven context), start with the base URL (static packs),
    // start with /s/ (surgery signposting page), or start with /symptom/ (specific symptom page)
    const hasToolkitSource =
      primarySource?.title?.startsWith('Signposting Toolkit') &&
      (primarySource?.url === null ||
       primarySource?.url?.startsWith(ADMIN_TOOLKIT_SOURCE_BASE_URL) ||
       primarySource?.url?.startsWith('/s/') ||
       primarySource?.url?.startsWith('/symptom/'))
    if (!hasToolkitSource) {
      issues.push({
        code: 'MISSING_TOOLKIT_SOURCE',
        message: 'Primary source must be Signposting Toolkit (internal).',
        cardTitle: card.title,
      })
    }

    const hasRcgpSource = card.sources.some((source) => source.url?.toLowerCase().includes('rcgp'))
    if (hasRcgpSource) {
      issues.push({
        code: 'FORBIDDEN_SOURCE',
        message: 'RCGP sources are not allowed for admin cards.',
        cardTitle: card.title,
      })
    }

    const cardHasTriageSignals = promptHasTriageSignals || hasTriageSignals(combined)
    const hasSlotGuidance = card.slotLanguage.relevant && card.slotLanguage.guidance.length > 0
    if (cardHasTriageSignals && !hasSlotGuidance) {
      issues.push({
        code: 'MISSING_SLOT_GUIDANCE',
        message: 'Slot guidance required for triage-related scenarios.',
        cardTitle: card.title,
      })
    }
  })

  return issues
}
