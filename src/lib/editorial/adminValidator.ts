import { z } from 'zod'
import { EditorialLearningCardZ } from '@/lib/schemas/editorial'
import { ADMIN_TOOLKIT_SOURCE_BASE_URL, ADMIN_TOOLKIT_SOURCE_TITLE } from '@/lib/editorial/toolkitSources'

type EditorialLearningCard = z.infer<typeof EditorialLearningCardZ>

export type AdminValidationIssue = {
  code: 'FORBIDDEN_PATTERN' | 'FORBIDDEN_SOURCE' | 'MISSING_SLOT_GUIDANCE' | 'MISSING_TOOLKIT_SOURCE'
  message: string
  cardTitle?: string
}

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /risk assessment/i, label: 'risk assessment' },
  { pattern: /protective factors/i, label: 'protective factors' },
  { pattern: /sigecaps/i, label: 'SIGECAPS' },
  { pattern: /phq-9/i, label: 'PHQ-9' },
  { pattern: /gad-7/i, label: 'GAD-7' },
  { pattern: /columbia/i, label: 'Columbia' },
  { pattern: /rcgp/i, label: 'RCGP' },
  { pattern: /\bdiagnos(e|is|ing)?\b/i, label: 'diagnose' },
  { pattern: /\bdifferential(s)?\b/i, label: 'differential' },
  { pattern: /titrate/i, label: 'titrate' },
  { pattern: /medication/i, label: 'medication' },
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

    FORBIDDEN_PATTERNS.forEach(({ pattern, label }) => {
      if (pattern.test(combined)) {
        issues.push({
          code: 'FORBIDDEN_PATTERN',
          message: `Forbidden content detected: ${label}`,
          cardTitle: card.title,
        })
      }
    })

    const primarySource = card.sources[0]
    const hasToolkitSource =
      primarySource?.title === ADMIN_TOOLKIT_SOURCE_TITLE &&
      primarySource?.url?.startsWith(ADMIN_TOOLKIT_SOURCE_BASE_URL)
    if (!hasToolkitSource) {
      issues.push({
        code: 'MISSING_TOOLKIT_SOURCE',
        message: 'Primary source must be Signposting Toolkit (internal).',
        cardTitle: card.title,
      })
    }

    const hasRcgpSource = card.sources.some((source) => source.url.toLowerCase().includes('rcgp'))
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
