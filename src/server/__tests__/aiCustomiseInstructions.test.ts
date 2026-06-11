import { customiseInstructions } from '@/server/aiCustomiseInstructions'
import { callAzureOpenAI } from '@/server/azureOpenAI'

jest.mock('@/server/azureOpenAI', () => ({
  ...jest.requireActual('@/server/azureOpenAI'),
  callAzureOpenAI: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    tokenUsageLog: { create: jest.fn() },
  },
}))

const mockedCallAzureOpenAI = callAzureOpenAI as jest.MockedFunction<typeof callAzureOpenAI>

const aiResponse = (json: Record<string, unknown>) => ({
  content: JSON.stringify(json),
  model: 'gpt-4o-mini',
  usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
})

const onboardingProfile = {
  surgeryName: 'Test Surgery',
  urgentCareModel: {
    hasDutyDoctor: true,
    dutyDoctorTerm: 'Duty GP',
    usesRedSlots: false,
    urgentSlotsDescription: 'Urgent slots',
  },
  bookingRules: { canBookDirectly: [], mustNotBookDirectly: '' },
  team: { roles: [], roleRoutingNotes: '' },
  escalation: { firstEscalation: 'Duty GP', urgentWording: 'Urgent' },
  localServices: {
    msk: '',
    mentalHealth: '',
    socialPrescribing: '',
    communityNursing: '',
    audiology: '',
    frailty: '',
    sexualHealth: '',
    outOfHours: '',
    includeInInstructions: 'no' as const,
  },
  communicationStyle: {
    detailLevel: 'moderate' as const,
    terminologyPreference: 'mixed' as const,
  },
}

const baseSymptom = (highlightedText: string | null) => ({
  name: 'Anxiety',
  ageGroup: 'Adult',
  briefInstruction: 'Pink/Purple telephone slot',
  highlightedText,
  instructionsHtml: '<p>Use the pink/purple telephone slot</p>',
})

const baseNotice = 'EMERGENCY CARE: (threat to life/harm) Use pink/purple/red telephone slot'

describe('customiseInstructions highlightedText handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('asks the AI to rewrite the notice when the base has one and strips HTML from the result', async () => {
    mockedCallAzureOpenAI.mockResolvedValueOnce(
      aiResponse({
        briefInstruction: 'Book GP triage',
        instructionsHtml: '<p>Book GP triage</p>',
        highlightedText: '<p>EMERGENCY CARE: (threat to life/harm) Use the <strong>Duty GP line</strong></p>',
      })
    )

    const result = await customiseInstructions(baseSymptom(baseNotice), onboardingProfile, 'admin@example.com')

    const { messages } = mockedCallAzureOpenAI.mock.calls[0][0]
    const systemPrompt = messages[0].content
    const userPrompt = messages[1].content

    expect(systemPrompt).toContain('IMPORTANT NOTICE (highlightedText)')
    expect(systemPrompt).toContain('"highlightedText": "string - the Important Notice rewritten as short plain text"')
    expect(userPrompt).toContain(`Important Notice (highlightedText): ${baseNotice}`)

    expect(result.highlightedText).toBe('EMERGENCY CARE: (threat to life/harm) Use the Duty GP line')
  })

  it('never mentions highlightedText in prompts and ignores returned values when the base has no notice', async () => {
    mockedCallAzureOpenAI.mockResolvedValueOnce(
      aiResponse({
        briefInstruction: 'Book GP triage',
        instructionsHtml: '<p>Book GP triage</p>',
        highlightedText: 'An invented notice',
      })
    )

    const result = await customiseInstructions(baseSymptom(null), onboardingProfile, 'admin@example.com')

    const { messages } = mockedCallAzureOpenAI.mock.calls[0][0]
    expect(messages[0].content).not.toContain('highlightedText')
    expect(messages[1].content).not.toContain('highlightedText')

    expect(result.highlightedText).toBeUndefined()
    expect(result.briefInstruction).toBe('Book GP triage')
  })

  it('treats a whitespace-only base notice as no notice', async () => {
    mockedCallAzureOpenAI.mockResolvedValueOnce(
      aiResponse({
        briefInstruction: 'Book GP triage',
        instructionsHtml: '<p>Book GP triage</p>',
      })
    )

    const result = await customiseInstructions(baseSymptom('   '), onboardingProfile, 'admin@example.com')

    expect(mockedCallAzureOpenAI.mock.calls[0][0].messages[0].content).not.toContain('highlightedText')
    expect(result.highlightedText).toBeUndefined()
  })

  it.each([
    ['omitted', {}],
    ['a non-string', { highlightedText: 42 }],
    ['tag-only HTML', { highlightedText: '<p></p>' }],
  ])('falls back gracefully when the AI notice is %s', async (_label, extra) => {
    mockedCallAzureOpenAI.mockResolvedValueOnce(
      aiResponse({
        briefInstruction: 'Book GP triage',
        instructionsHtml: '<p>Book GP triage</p>',
        ...extra,
      })
    )

    const result = await customiseInstructions(baseSymptom(baseNotice), onboardingProfile, 'admin@example.com')

    expect(result.highlightedText).toBeUndefined()
    expect(result.briefInstruction).toBe('Book GP triage')
    expect(result.instructionsHtml).toBe('<p>Book GP triage</p>')
  })

  it('still throws when instructionsHtml is missing', async () => {
    mockedCallAzureOpenAI.mockResolvedValueOnce(
      aiResponse({
        briefInstruction: 'Book GP triage',
        highlightedText: 'EMERGENCY CARE: call the Duty GP',
      })
    )

    await expect(
      customiseInstructions(baseSymptom(baseNotice), onboardingProfile, 'admin@example.com')
    ).rejects.toThrow('AI response missing instructionsHtml')
  })
})
