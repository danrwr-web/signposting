import { validateAdminCards } from '../adminValidator'

const baseCard = {
  targetRole: 'ADMIN' as const,
  title: 'Admin escalation basics',
  estimatedTimeMinutes: 5,
  tags: ['mental health'],
  riskLevel: 'HIGH' as const,
  needsSourcing: false,
  reviewByDate: '2026-02-01',
  sources: [
    {
      title: 'Signposting Toolkit (internal)',
      url: 'https://app.signpostingtool.co.uk/toolkit/mental-health-crisis',
      publisher: 'Signposting Toolkit',
    },
  ],
  contentBlocks: [{ type: 'text' as const, text: 'Use the toolkit script and escalate.' }],
  interactions: [
    {
      type: 'mcq' as const,
      question: 'What should you do next?',
      options: ['Escalate to duty GP', 'Offer counselling'],
      correctIndex: 0,
      explanation: 'Escalate to the duty GP.',
    },
  ],
  slotLanguage: { relevant: true, guidance: [{ slot: 'Red' as const, rule: 'Call 999 for immediate danger.' }] },
  safetyNetting: ['Call 999 if danger is immediate.'],
}

describe('adminValidator', () => {
  it('flags forbidden patterns like PHQ-9', () => {
    const issues = validateAdminCards({
      cards: [
        {
          ...baseCard,
          contentBlocks: [{ type: 'text', text: 'Use PHQ-9 during calls.' }],
        },
      ],
      promptText: 'Admin mental health crisis',
    })

    expect(issues.some((issue) => issue.code === 'FORBIDDEN_PATTERN')).toBe(true)
  })

  it('flags missing toolkit source', () => {
    const issues = validateAdminCards({
      cards: [{ ...baseCard, sources: [{ title: 'NHS', url: 'https://www.nhs.uk/conditions/' }] }],
      promptText: 'Admin mental health crisis',
    })

    expect(issues.some((issue) => issue.code === 'MISSING_TOOLKIT_SOURCE')).toBe(true)
  })

  it('accepts toolkit source with /s/ URL (surgery signposting page)', () => {
    const issues = validateAdminCards({
      cards: [
        {
          ...baseCard,
          sources: [
            {
              title: 'Signposting Toolkit (internal)',
              url: '/s/surgery-1',
              publisher: 'Signposting Toolkit',
            },
          ],
        },
      ],
      promptText: 'Admin mental health crisis',
    })

    expect(issues.some((issue) => issue.code === 'MISSING_TOOLKIT_SOURCE')).toBe(false)
  })

  it('accepts toolkit source with /symptom/ URL (specific symptom page)', () => {
    const issues = validateAdminCards({
      cards: [
        {
          ...baseCard,
          sources: [
            {
              title: 'Signposting Toolkit (internal)',
              url: '/symptom/abc123?surgery=surgery-1',
              publisher: 'Signposting Toolkit',
            },
          ],
        },
      ],
      promptText: 'Admin mental health crisis',
    })

    expect(issues.some((issue) => issue.code === 'MISSING_TOOLKIT_SOURCE')).toBe(false)
  })

  it('accepts toolkit source with null URL', () => {
    const issues = validateAdminCards({
      cards: [
        {
          ...baseCard,
          sources: [
            {
              title: 'Signposting Toolkit (internal)',
              url: null,
              publisher: 'Signposting Toolkit',
            },
          ],
        },
      ],
      promptText: 'Admin mental health crisis',
    })

    expect(issues.some((issue) => issue.code === 'MISSING_TOOLKIT_SOURCE')).toBe(false)
  })

  it('flags missing slot guidance for triage prompts', () => {
    const issues = validateAdminCards({
      cards: [
        {
          ...baseCard,
          slotLanguage: { relevant: false, guidance: [] },
        },
      ],
      promptText: 'Admin triage slot guidance for urgent mental health',
    })

    expect(issues.some((issue) => issue.code === 'MISSING_SLOT_GUIDANCE')).toBe(true)
  })
})
