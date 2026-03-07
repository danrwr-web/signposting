import { parseAndValidateGeneration } from '../generationParsing'

describe('generationParsing', () => {
  it('repairs common JSON issues and normalises enums', () => {
    const output = `
Here is the JSON you asked for:
{
  cards: [
    {
      targetRole: "Admin",
      title: "Mental health crisis escalation",
      estimatedTimeMinutes: 5,
      tags: ["mental health"],
      riskLevel: "High",
      needsSourcing: false,
      reviewByDate: "2026-02-01",
      sources: [{ title: "NHS", url: "https://www.nhs.uk/conditions/" }],
      contentBlocks: [{ type: "text", text: "Recognise red flags." }],
      interactions: {
        type: "mcq",
        question: "What should you do?",
        options: ["Escalate", "Wait"],
        correctIndex: "0",
        explanation: "Escalate immediately."
      },
      slotLanguage: { relevant: true, guidance: { slot: "Pink/Purple", rule: "Book soon." } },
      safetyNetting: ["Call 999 if danger is immediate."],
    },
  ],
  quiz: {
    title: "Quick check",
    questions: {
      type: "mcq",
      question: "Which slot for urgent concerns?",
      options: ["Red", "Green"],
      correctIndex: "0",
      explanation: "Red slots are urgent."
    },
  },
}
`

    const result = parseAndValidateGeneration(output)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.repaired).toBe(true)
    expect(result.data.cards[0].targetRole).toBe('ADMIN')
    expect(result.data.cards[0].riskLevel).toBe('HIGH')
    expect(result.data.cards[0].slotLanguage.guidance[0].slot).toBe('Pink-Purple')
    expect(result.data.cards[0].interactions).toHaveLength(1)
    expect(result.data.cards[0].interactions[0].correctIndex).toBe(0)
    expect(result.data.quiz.questions[0].correctIndex).toBe(0)
  })

  it('returns issues when required fields are missing', () => {
    const output = JSON.stringify({
      cards: [
        {
          targetRole: 'ADMIN',
          estimatedTimeMinutes: 5,
          tags: [],
          riskLevel: 'LOW',
          needsSourcing: false,
          reviewByDate: '2026-02-01',
          sources: [{ title: 'NHS', url: 'https://www.nhs.uk/conditions/' }],
          contentBlocks: [{ type: 'text', text: 'Missing title.' }],
          interactions: [
            {
              type: 'mcq',
              question: 'What next?',
              options: ['Escalate', 'Wait'],
              correctIndex: 0,
              explanation: 'Escalate.',
            },
          ],
          slotLanguage: { relevant: true, guidance: [{ slot: 'Red', rule: 'Escalate.' }] },
          safetyNetting: ['Call 999 if danger is immediate.'],
        },
      ],
      quiz: {
        title: 'Quick check',
        questions: [
          {
            type: 'mcq',
            question: 'Which slot is urgent?',
            options: ['Red', 'Green'],
            correctIndex: 0,
            explanation: 'Red slots are urgent.',
          },
        ],
      },
    })

    const result = parseAndValidateGeneration(output)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.issues.some((issue) => issue.path.includes('title'))).toBe(true)
  })

  it('repairs empty or missing safetyNetting with default', () => {
    const output = JSON.stringify({
      cards: [
        {
          targetRole: 'ADMIN',
          title: 'Infection awareness',
          estimatedTimeMinutes: 5,
          tags: ['Infection'],
          riskLevel: 'MED',
          needsSourcing: false,
          reviewByDate: '2026-02-01',
          sources: [{ title: 'NHS', url: 'https://www.nhs.uk/' }],
          contentBlocks: [{ type: 'text', text: 'Recognise infection symptoms.' }],
          interactions: [
            {
              type: 'mcq',
              question: 'What should you do?',
              options: ['Book Red', 'Book Green'],
              correctIndex: 0,
              explanation: 'Book Red for urgent symptoms.',
            },
          ],
          slotLanguage: { relevant: true, guidance: [{ slot: 'Red', rule: 'Urgent.' }] },
          safetyNetting: [],
        },
      ],
      quiz: {
        title: 'Quick check',
        questions: [
          {
            type: 'mcq',
            question: 'Which slot?',
            options: ['Red', 'Green'],
            correctIndex: 0,
            explanation: 'Red.',
          },
        ],
      },
    })

    const result = parseAndValidateGeneration(output)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.cards[0].safetyNetting).toHaveLength(1)
    expect(result.data.cards[0].safetyNetting[0]).toContain('symptoms worsen')
  })

  it('replaces "Book a red slot" with full escalation wording in MCQ options', () => {
    const output = JSON.stringify({
      cards: [
        {
          targetRole: 'ADMIN',
          title: 'Urgent slot booking',
          estimatedTimeMinutes: 5,
          tags: ['urgent'],
          riskLevel: 'HIGH',
          needsSourcing: false,
          reviewByDate: '2026-02-01',
          sources: [{ title: 'NHS', url: 'https://www.nhs.uk/' }],
          contentBlocks: [{ type: 'text', text: 'Patient needs urgent care.' }],
          interactions: [
            {
              type: 'mcq',
              question: 'What is the correct action?',
              options: ['Book a red slot', 'Book a green slot'],
              correctIndex: 0,
              explanation: 'Book a red slot for urgent cases.',
            },
          ],
          slotLanguage: { relevant: true, guidance: [{ slot: 'Red', rule: 'Book a red slot for same-day urgent.' }] },
          safetyNetting: ['Escalate if needed.'],
        },
      ],
      quiz: {
        title: 'Quick check',
        questions: [
          {
            type: 'mcq',
            question: 'Which action?',
            options: ['Book a red slot', 'Book green'],
            correctIndex: 0,
            explanation: 'Red slot.',
          },
        ],
      },
    })

    const result = parseAndValidateGeneration(output)
    expect(result.success).toBe(true)
    if (!result.success) return
    const cardOptions = result.data.cards[0].interactions[0].options
    expect(cardOptions[0]).toBe(
      'Book a red slot (or pink/purple today if any remaining) - Remember to IM the GP'
    )
    expect(result.data.cards[0].interactions[0].explanation).toContain(
      'Book a red slot (or pink/purple today if any remaining)'
    )
    expect(result.data.cards[0].slotLanguage.guidance[0].rule).toContain(
      'Book a red slot (or pink/purple today if any remaining)'
    )
    expect(result.data.quiz.questions[0].options[0]).toBe(
      'Book a red slot (or pink/purple today if any remaining) - Remember to IM the GP'
    )
  })
})
