import {
  customiseInstructions,
  detectColourSlotUsage,
  findLeakedColourSlotTerms,
  getAllowedColourTerms,
} from '@/server/aiCustomiseInstructions'
import { callAzureOpenAI } from '@/server/azureOpenAI'
import { prisma } from '@/lib/prisma'

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

const disabledArchetype = { enabled: false, localName: '', clinicianRole: '', description: '' }

const archetypeProfile = {
  ...onboardingProfile,
  appointmentModel: {
    routineContinuityGp: {
      enabled: true,
      localName: 'Book on the Day GP',
      clinicianRole: 'GP',
      description: 'Routine appointments with continuity',
    },
    routineGpPhone: disabledArchetype,
    gpTriage48h: {
      enabled: true,
      localName: 'Doctor First Triage',
      clinicianRole: 'GP',
      description: 'GP triage within 48 hours',
    },
    urgentSameDayPhone: {
      enabled: true,
      localName: 'Duty GP Call',
      clinicianRole: 'Duty GP',
      description: 'Urgent same-day telephone',
    },
    urgentSameDayF2F: disabledArchetype,
    otherClinicianDirect: disabledArchetype,
    clinicianArchetypes: [],
  },
}

const cleanResponse = aiResponse({
  briefInstruction: 'Book Doctor First Triage',
  instructionsHtml: '<p>Book Doctor First Triage</p>',
})

describe('findLeakedColourSlotTerms', () => {
  const noColours = new Set<string>()

  it.each([
    'Use the pink/purple telephone slot',
    'Book one of the red slots',
    'EMERGENCY CARE: use the pink/purple/red telephone slot',
    'Try an orange slot first',
    'book a green slot with their usual GP',
  ])('flags colour-slot phrases in %j', (text) => {
    expect(findLeakedColourSlotTerms(text, noColours).length).toBeGreaterThan(0)
  })

  it.each([
    'Check for red flags before booking',
    'shown in a red alert box',
    'we have duty doctor slots',
    'book a routine GP appointment',
  ])('does not flag %j', (text) => {
    expect(findLeakedColourSlotTerms(text, noColours)).toEqual([])
  })

  it('respects allowed colours, treating pink and purple as one group', () => {
    const allowed = new Set(['pink'])
    expect(findLeakedColourSlotTerms('Use the pink/purple slot', allowed)).toEqual([])
    expect(findLeakedColourSlotTerms('Use the purple slot', allowed)).toEqual([])
    expect(findLeakedColourSlotTerms('Use the orange slot', allowed)).toEqual(['orange slot'])
    // A combined phrase leaks if any of its colours is not allowed
    expect(findLeakedColourSlotTerms('use the pink/purple/red telephone slot', allowed))
      .toEqual(['pink/purple/red telephone slot'])
  })

  it('scans HTML content as plain text', () => {
    expect(
      findLeakedColourSlotTerms('<p>Use the <strong>orange</strong>&nbsp;slot</p>', noColours)
    ).toEqual(['orange slot'])
  })
})

describe('detectColourSlotUsage', () => {
  it('is true when the structured usesRedSlots flag is set', () => {
    const profile = {
      ...onboardingProfile,
      urgentCareModel: { ...onboardingProfile.urgentCareModel, usesRedSlots: true },
    }
    expect(detectColourSlotUsage(profile)).toBe(true)
  })

  it('is true when free text contains an explicit colour-slot phrase', () => {
    const profile = {
      ...onboardingProfile,
      urgentCareModel: {
        ...onboardingProfile.urgentCareModel,
        urgentSlotsDescription: 'Reception can book orange slots directly',
      },
    }
    expect(detectColourSlotUsage(profile)).toBe(true)
  })

  it('is false for a bare mention of "slot" without a colour', () => {
    const profile = {
      ...onboardingProfile,
      urgentCareModel: {
        ...onboardingProfile.urgentCareModel,
        urgentSlotsDescription: 'we have duty doctor slots',
      },
    }
    expect(detectColourSlotUsage(profile)).toBe(false)
  })

  it('survives a legacy profile with missing sections', () => {
    expect(detectColourSlotUsage({ urgentCareModel: undefined } as any)).toBe(false)
  })
})

describe('getAllowedColourTerms', () => {
  it('allows every colour for a genuine colour-slot surgery without an appointment model', () => {
    const profile = {
      ...onboardingProfile,
      urgentCareModel: { ...onboardingProfile.urgentCareModel, usesRedSlots: true },
    }
    expect(getAllowedColourTerms(profile)).toEqual(
      new Set(['green', 'pink', 'purple', 'orange', 'red'])
    )
  })

  it('allows only colours appearing in enabled archetype local names', () => {
    const profile = {
      ...archetypeProfile,
      appointmentModel: {
        ...archetypeProfile.appointmentModel,
        routineContinuityGp: {
          ...archetypeProfile.appointmentModel.routineContinuityGp,
          localName: 'Green Slot',
        },
      },
    }
    expect(getAllowedColourTerms(profile)).toEqual(new Set(['green']))
  })

  it('allows nothing for a non-colour surgery with no colour local names', () => {
    expect(getAllowedColourTerms(archetypeProfile)).toEqual(new Set())
  })
})

describe('customiseInstructions colour-slot handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('gives the AI an explicit colour → local-name mapping on the archetype path', async () => {
    mockedCallAzureOpenAI.mockResolvedValueOnce(cleanResponse)

    await customiseInstructions(baseSymptom(null), archetypeProfile, 'admin@example.com')

    const systemPrompt = mockedCallAzureOpenAI.mock.calls[0][0].messages[0].content
    expect(systemPrompt).toContain('BASE COLOUR-SLOT TRANSLATION (MANDATORY)')
    expect(systemPrompt).toContain('- "Green slot" → "Book on the Day GP"')
    expect(systemPrompt).toContain(
      '- "Pink/Purple slot" (also "pink slot" or "purple slot") → "Doctor First Triage"'
    )
    // urgentSameDayF2F is disabled, so Orange falls back to urgentSameDayPhone
    expect(systemPrompt).toContain('- "Orange slot" → "Duty GP Call"')
    expect(systemPrompt).toContain('- "Red slot" (also "red telephone slot") → "Duty GP Call"')
    // The unconditional colour anchors are gone
    expect(systemPrompt).not.toContain('(Green slot equivalent)')
    expect(systemPrompt).not.toContain('"Red Slot" rules')
  })

  it('does not treat a bare mention of "slot" as colour-slot usage', async () => {
    mockedCallAzureOpenAI.mockResolvedValueOnce(cleanResponse)
    const profile = {
      ...onboardingProfile,
      urgentCareModel: {
        ...onboardingProfile.urgentCareModel,
        urgentSlotsDescription: 'we have duty doctor slots',
      },
    }

    await customiseInstructions(baseSymptom(null), profile, 'admin@example.com')

    const systemPrompt = mockedCallAzureOpenAI.mock.calls[0][0].messages[0].content
    expect(systemPrompt).toContain('This surgery does not use colour-coded slot names')
    expect(systemPrompt).not.toContain('You must keep and use these terms')
  })

  it('preserves colour terminology when the structured usesRedSlots flag is set', async () => {
    mockedCallAzureOpenAI.mockResolvedValueOnce(cleanResponse)
    const profile = {
      ...onboardingProfile,
      urgentCareModel: {
        ...onboardingProfile.urgentCareModel,
        usesRedSlots: true,
        urgentSlotsDescription: 'The duty doctor triages everything',
      },
    }

    await customiseInstructions(baseSymptom(null), profile, 'admin@example.com')

    const systemPrompt = mockedCallAzureOpenAI.mock.calls[0][0].messages[0].content
    expect(systemPrompt).toContain('This surgery uses colour-coded urgent appointment types')
  })

  it('retries once with a corrective message when base colour terms leak through', async () => {
    mockedCallAzureOpenAI
      .mockResolvedValueOnce(
        aiResponse({
          briefInstruction: 'Book triage',
          instructionsHtml: '<p>Use the pink/purple slot</p>',
        })
      )
      .mockResolvedValueOnce(cleanResponse)

    const result = await customiseInstructions(baseSymptom(null), onboardingProfile, 'admin@example.com')

    expect(mockedCallAzureOpenAI).toHaveBeenCalledTimes(2)
    const retryMessages = mockedCallAzureOpenAI.mock.calls[1][0].messages
    expect(retryMessages).toHaveLength(4)
    expect(retryMessages[2].role).toBe('assistant')
    expect(retryMessages[3].role).toBe('user')
    expect(retryMessages[3].content).toContain('pink/purple slot')
    expect(retryMessages[3].content).toContain('Rewrite your answer')

    expect(result.instructionsHtml).toBe('<p>Book Doctor First Triage</p>')
    expect(result.residualColourTerms).toBeUndefined()

    // Token usage is accumulated across both attempts
    expect(prisma.tokenUsageLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptTokens: 200,
          completionTokens: 200,
          totalTokens: 400,
        }),
      })
    )
  })

  it('returns residualColourTerms when the retry still leaks', async () => {
    const leaking = aiResponse({
      briefInstruction: 'Book triage',
      instructionsHtml: '<p>Use the orange slot</p>',
    })
    mockedCallAzureOpenAI.mockResolvedValueOnce(leaking).mockResolvedValueOnce(leaking)

    const result = await customiseInstructions(baseSymptom(null), onboardingProfile, 'admin@example.com')

    expect(mockedCallAzureOpenAI).toHaveBeenCalledTimes(2)
    expect(result.instructionsHtml).toBe('<p>Use the orange slot</p>')
    expect(result.residualColourTerms).toEqual(['orange slot'])
  })

  it('keeps the first answer and flags it when the retry itself fails', async () => {
    mockedCallAzureOpenAI
      .mockResolvedValueOnce(
        aiResponse({
          briefInstruction: 'Book triage',
          instructionsHtml: '<p>Use the orange slot</p>',
        })
      )
      .mockResolvedValueOnce({
        content: 'not json at all',
        model: 'gpt-4o-mini',
        usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
      })

    const result = await customiseInstructions(baseSymptom(null), onboardingProfile, 'admin@example.com')

    expect(result.instructionsHtml).toBe('<p>Use the orange slot</p>')
    expect(result.residualColourTerms).toEqual(['orange slot'])
  })

  it('never retries a surgery that genuinely uses colour-coded slots', async () => {
    mockedCallAzureOpenAI.mockResolvedValueOnce(
      aiResponse({
        briefInstruction: 'Book a red slot',
        instructionsHtml: '<p>Book a red slot with the Duty Doctor</p>',
      })
    )
    const profile = {
      ...onboardingProfile,
      urgentCareModel: { ...onboardingProfile.urgentCareModel, usesRedSlots: true },
    }

    const result = await customiseInstructions(baseSymptom(null), profile, 'admin@example.com')

    expect(mockedCallAzureOpenAI).toHaveBeenCalledTimes(1)
    expect(result.residualColourTerms).toBeUndefined()
  })

  it('allows colours from the surgery\'s own local names but still catches other leaks', async () => {
    const profileWithGreenSlot = {
      ...archetypeProfile,
      appointmentModel: {
        ...archetypeProfile.appointmentModel,
        routineContinuityGp: {
          ...archetypeProfile.appointmentModel.routineContinuityGp,
          localName: 'Green Slot',
        },
      },
    }
    mockedCallAzureOpenAI
      .mockResolvedValueOnce(
        aiResponse({
          briefInstruction: 'Book a Green Slot',
          instructionsHtml: '<p>Book a Green Slot, or an orange slot if urgent</p>',
        })
      )
      .mockResolvedValueOnce(
        aiResponse({
          briefInstruction: 'Book a Green Slot',
          instructionsHtml: '<p>Book a Green Slot, or Duty GP Call if urgent</p>',
        })
      )

    const result = await customiseInstructions(baseSymptom(null), profileWithGreenSlot, 'admin@example.com')

    expect(mockedCallAzureOpenAI).toHaveBeenCalledTimes(2)
    const corrective = mockedCallAzureOpenAI.mock.calls[1][0].messages[3].content
    expect(corrective).toContain('orange slot')
    expect(corrective).not.toContain('green slot')
    expect(result.residualColourTerms).toBeUndefined()
  })

  it('checks the rewritten Important Notice for leaks too', async () => {
    mockedCallAzureOpenAI
      .mockResolvedValueOnce(
        aiResponse({
          briefInstruction: 'Book triage',
          instructionsHtml: '<p>Book triage</p>',
          highlightedText: 'EMERGENCY CARE: use the red telephone slot',
        })
      )
      .mockResolvedValueOnce(
        aiResponse({
          briefInstruction: 'Book triage',
          instructionsHtml: '<p>Book triage</p>',
          highlightedText: 'EMERGENCY CARE: call the Duty GP',
        })
      )

    const result = await customiseInstructions(baseSymptom(baseNotice), onboardingProfile, 'admin@example.com')

    expect(mockedCallAzureOpenAI).toHaveBeenCalledTimes(2)
    expect(result.highlightedText).toBe('EMERGENCY CARE: call the Duty GP')
    expect(result.residualColourTerms).toBeUndefined()
  })
})
