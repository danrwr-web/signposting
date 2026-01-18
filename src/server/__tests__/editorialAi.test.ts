import { generateEditorialBatch, regenerateEditorialSection } from '../editorialAi'

const mockFetch = jest.fn()

describe('editorialAi', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    global.fetch = mockFetch
    process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com/'
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_DEPLOYMENT = 'test-deployment'
    process.env.AZURE_OPENAI_API_VERSION = '2024-02-15-preview'
  })

  it('parses generated cards and quiz', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                cards: [
                  {
                    targetRole: 'ADMIN',
                    title: 'Mental health crisis escalation',
                    estimatedTimeMinutes: 5,
                    tags: ['mental health'],
                    riskLevel: 'HIGH',
                    needsSourcing: false,
                    reviewByDate: '2026-02-01',
                    sources: [
                      {
                        title: 'Signposting Toolkit (internal)',
                        url: 'https://app.signpostingtool.co.uk/toolkit/mental-health-crisis',
                        publisher: 'Signposting Toolkit',
                      },
                      { title: 'NHS', url: 'https://www.nhs.uk/conditions/' },
                    ],
                    contentBlocks: [{ type: 'text', text: 'Recognise warning signs.' }],
                    interactions: [
                      {
                        type: 'mcq',
                        question: 'Who should you escalate to?',
                        options: ['Duty GP', 'Pharmacy'],
                        correctIndex: 0,
                        explanation: 'Escalate to Duty GP.',
                      },
                    ],
                    slotLanguage: { relevant: true, guidance: [{ slot: 'Red', rule: '999 or same-day GP.' }] },
                    safetyNetting: ['Escalate immediately for risk to life.'],
                  },
                ],
                quiz: {
                  title: 'Quick check',
                  questions: [
                    {
                      type: 'mcq',
                      question: 'Which slot for crisis?',
                      options: ['Red', 'Green'],
                      correctIndex: 0,
                      explanation: 'Red slots are urgent.',
                    },
                  ],
                },
              }),
            },
          },
        ],
        model: 'gpt-test',
      }),
    })

    const result = await generateEditorialBatch({
      promptText: 'Generate cards about mental health crises',
      targetRole: 'ADMIN',
      count: 1,
      interactiveFirst: true,
      tags: ['mental health'],
    })

    expect(result.cards).toHaveLength(1)
    expect(result.quiz.questions).toHaveLength(1)
    expect(result.modelUsed).toBe('gpt-test')
  })

  it('retries generation when admin validation fails', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  cards: [
                    {
                      targetRole: 'ADMIN',
                      title: 'Mental health support screening',
                      estimatedTimeMinutes: 5,
                      tags: ['mental health'],
                      riskLevel: 'MED',
                      needsSourcing: false,
                      reviewByDate: '2026-02-01',
                      sources: [
                        {
                          title: 'Signposting Toolkit (internal)',
                          url: 'https://app.signpostingtool.co.uk/toolkit/mental-health-crisis',
                          publisher: 'Signposting Toolkit',
                        },
                      ],
                      contentBlocks: [{ type: 'text', text: 'Use PHQ-9 during calls.' }],
                      interactions: [
                        {
                          type: 'mcq',
                          question: 'What should you do next?',
                          options: ['Escalate to duty GP', 'Offer counselling'],
                          correctIndex: 0,
                          explanation: 'Escalate to the duty GP.',
                        },
                      ],
                      slotLanguage: {
                        relevant: true,
                        guidance: [{ slot: 'Orange', rule: 'Same-day clinician call-back.' }],
                      },
                      safetyNetting: ['Call 999 if there is immediate danger.'],
                    },
                  ],
                  quiz: {
                    title: 'Quick check',
                    questions: [
                      {
                        type: 'mcq',
                        question: 'Which slot is urgent?',
                        options: ['Orange', 'Green'],
                        correctIndex: 0,
                        explanation: 'Orange slots are urgent.',
                      },
                    ],
                  },
                }),
              },
            },
          ],
          model: 'gpt-test-1',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  cards: [
                    {
                      targetRole: 'ADMIN',
                      title: 'Admin escalation for mental health crisis',
                      estimatedTimeMinutes: 5,
                      tags: ['mental health'],
                      riskLevel: 'HIGH',
                      needsSourcing: false,
                      reviewByDate: '2026-02-01',
                      sources: [
                        {
                          title: 'Signposting Toolkit (internal)',
                          url: 'https://app.signpostingtool.co.uk/toolkit/mental-health-crisis',
                          publisher: 'Signposting Toolkit',
                        },
                        { title: 'NHS', url: 'https://www.nhs.uk/conditions/' },
                      ],
                      contentBlocks: [{ type: 'text', text: 'Use the toolkit script and escalate.' }],
                      interactions: [
                        {
                          type: 'mcq',
                          question: 'Who should you alert?',
                          options: ['Duty GP', 'Pharmacy'],
                          correctIndex: 0,
                          explanation: 'Alert the duty GP.',
                        },
                      ],
                      slotLanguage: {
                        relevant: true,
                        guidance: [{ slot: 'Red', rule: 'Call 999 for immediate danger.' }],
                      },
                      safetyNetting: ['Call 999 if danger is immediate.'],
                    },
                  ],
                  quiz: {
                    title: 'Quick check',
                    questions: [
                      {
                        type: 'mcq',
                        question: 'Which slot is for immediate danger?',
                        options: ['Red', 'Green'],
                        correctIndex: 0,
                        explanation: 'Red slots are for immediate danger.',
                      },
                    ],
                  },
                }),
              },
            },
          ],
          model: 'gpt-test-2',
        }),
      })

    const result = await generateEditorialBatch({
      promptText: 'Create 1 learning card for the admin team about mental health crisis.',
      targetRole: 'ADMIN',
      count: 1,
      interactiveFirst: true,
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result.modelUsed).toBe('gpt-test-2')
    expect(result.cards[0].title).toBe('Admin escalation for mental health crisis')
  })

  it('returns patch for regenerated section', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                interaction: {
                  type: 'mcq',
                  question: 'Updated MCQ?',
                  options: ['Option 1', 'Option 2'],
                  correctIndex: 1,
                  explanation: 'Option 2 is correct.',
                },
              }),
            },
          },
        ],
        model: 'gpt-test',
      }),
    })

    const result = await regenerateEditorialSection({
      card: {
        targetRole: 'ADMIN',
        title: 'Sample',
        estimatedTimeMinutes: 5,
        tags: [],
        riskLevel: 'LOW',
        needsSourcing: false,
        reviewByDate: '2026-02-01',
        sources: [{ title: 'NHS', url: 'https://www.nhs.uk/conditions/' }],
        contentBlocks: [{ type: 'text', text: 'Hello' }],
        interactions: [
          {
            type: 'mcq',
            question: 'Original?',
            options: ['A', 'B'],
            correctIndex: 0,
            explanation: 'A is correct.',
          },
        ],
        slotLanguage: { relevant: false, guidance: [] },
        safetyNetting: ['Escalate if needed.'],
      },
      section: 'mcq',
    })

    expect(result.patch.interaction.question).toBe('Updated MCQ?')
  })
})
