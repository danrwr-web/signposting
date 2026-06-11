import { computeAiRerunPlan, isSymptomSafeToRerun } from '@/server/aiRerunPlan'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    surgerySymptomOverride: { findMany: jest.fn() },
    symptomHistory: { findMany: jest.fn() },
  },
}))

jest.mock('@/server/effectiveSymptoms', () => ({
  getEffectiveSymptoms: jest.fn(),
}))

const mockedGetEffectiveSymptoms = getEffectiveSymptoms as jest.MockedFunction<
  typeof getEffectiveSymptoms
>
const mockedOverrideFindMany = prisma.surgerySymptomOverride.findMany as jest.Mock
const mockedHistoryFindMany = prisma.symptomHistory.findMany as jest.Mock

const effectiveSymptom = (fields: any) => ({
  slug: 'slug',
  briefInstruction: null,
  highlightedText: null,
  instructions: null,
  instructionsJson: null,
  instructionsHtml: null,
  linkToPage: null,
  ...fields,
})

const setup = ({
  effective = [],
  overrides = [],
  history = [],
}: {
  effective?: any[]
  overrides?: any[]
  history?: any[]
}) => {
  mockedGetEffectiveSymptoms.mockResolvedValueOnce(effective as any)
  mockedOverrideFindMany.mockResolvedValueOnce(overrides)
  mockedHistoryFindMany.mockResolvedValueOnce(history)
}

describe('computeAiRerunPlan', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('classifies a base symptom with no override as never-customised and safe', async () => {
    setup({
      effective: [effectiveSymptom({ id: 'base-1', name: 'Fever', ageGroup: 'U5', source: 'base' })],
    })

    const plan = await computeAiRerunPlan('surgery-1')

    expect(plan.items).toEqual([
      expect.objectContaining({
        id: 'base-1',
        classification: 'never-customised',
        safeToRerun: true,
      }),
    ])
    expect(plan.safeCount).toBe(1)
    expect(plan.skippedCount).toBe(0)
  })

  it('treats a name-only override (no content fields) as safe', async () => {
    setup({
      effective: [
        effectiveSymptom({
          id: 'base-1',
          baseSymptomId: 'base-1',
          name: 'Fever (local)',
          ageGroup: 'U5',
          source: 'override',
        }),
      ],
      overrides: [
        {
          baseSymptomId: 'base-1',
          briefInstruction: null,
          instructionsHtml: null,
          lastEditedBy: 'Admin',
          lastEditedAt: new Date('2026-01-01'),
        },
      ],
    })

    const plan = await computeAiRerunPlan('surgery-1')

    expect(plan.items[0]).toMatchObject({ classification: 'never-customised', safeToRerun: true })
  })

  it('marks an override matching an AI history output as safe to re-run', async () => {
    setup({
      effective: [
        effectiveSymptom({
          id: 'base-1',
          baseSymptomId: 'base-1',
          name: 'Fever',
          ageGroup: 'U5',
          source: 'override',
        }),
      ],
      overrides: [
        {
          baseSymptomId: 'base-1',
          briefInstruction: 'AI brief',
          instructionsHtml: '<p>AI instructions</p>',
          lastEditedBy: 'Admin',
          lastEditedAt: new Date('2026-01-01'),
        },
      ],
      history: [
        {
          symptomId: 'base-1',
          modelUsed: 'gpt-4o-mini',
          newBriefInstruction: 'AI brief',
          newInstructionsHtml: '<p>AI instructions</p>',
        },
      ],
    })

    const plan = await computeAiRerunPlan('surgery-1')

    expect(plan.items[0]).toMatchObject({ classification: 'ai-customised', safeToRerun: true })
  })

  it('skips an override whose content does not match any AI output', async () => {
    setup({
      effective: [
        effectiveSymptom({
          id: 'base-1',
          baseSymptomId: 'base-1',
          name: 'Fever',
          ageGroup: 'U5',
          source: 'override',
        }),
      ],
      overrides: [
        {
          baseSymptomId: 'base-1',
          briefInstruction: 'Hand-tuned brief',
          instructionsHtml: '<p>Hand-tuned instructions</p>',
          lastEditedBy: 'Practice Manager',
          lastEditedAt: new Date('2026-05-01'),
        },
      ],
      history: [
        {
          symptomId: 'base-1',
          modelUsed: 'gpt-4o-mini',
          newBriefInstruction: 'AI brief',
          newInstructionsHtml: '<p>AI instructions</p>',
        },
      ],
    })

    const plan = await computeAiRerunPlan('surgery-1')

    expect(plan.items[0]).toMatchObject({
      classification: 'human-edited',
      safeToRerun: false,
      lastEditedBy: 'Practice Manager',
    })
    expect(plan.skippedCount).toBe(1)
  })

  it.each([
    ['unknown-model (manual editor save)', 'unknown-model'],
    ['REVERT (revert operation)', 'REVERT'],
  ])('does not treat %s history rows as AI output', async (_label, modelUsed) => {
    setup({
      effective: [
        effectiveSymptom({
          id: 'base-1',
          baseSymptomId: 'base-1',
          name: 'Fever',
          ageGroup: 'U5',
          source: 'override',
        }),
      ],
      overrides: [
        {
          baseSymptomId: 'base-1',
          briefInstruction: 'Saved brief',
          instructionsHtml: '<p>Saved instructions</p>',
          lastEditedBy: 'Admin',
          lastEditedAt: new Date('2026-05-01'),
        },
      ],
      history: [
        {
          symptomId: 'base-1',
          modelUsed,
          newBriefInstruction: 'Saved brief',
          newInstructionsHtml: '<p>Saved instructions</p>',
        },
      ],
    })

    const plan = await computeAiRerunPlan('surgery-1')

    expect(plan.items[0]).toMatchObject({ classification: 'human-edited', safeToRerun: false })
  })

  it('only re-runs custom symptoms whose content is AI output', async () => {
    setup({
      effective: [
        effectiveSymptom({
          id: 'custom-ai',
          name: 'Local AI symptom',
          ageGroup: 'Adult',
          source: 'custom',
          briefInstruction: 'AI brief',
          instructionsHtml: '<p>AI instructions</p>',
        }),
        effectiveSymptom({
          id: 'custom-human',
          name: 'Local human symptom',
          ageGroup: 'Adult',
          source: 'custom',
          briefInstruction: 'Authored brief',
          instructionsHtml: '<p>Authored instructions</p>',
        }),
      ],
      history: [
        {
          symptomId: 'custom-ai',
          modelUsed: 'gpt-4o-mini',
          newBriefInstruction: 'AI brief',
          newInstructionsHtml: '<p>AI instructions</p>',
        },
      ],
    })

    const plan = await computeAiRerunPlan('surgery-1')

    expect(plan.items.find((i) => i.id === 'custom-ai')).toMatchObject({
      classification: 'ai-customised',
      safeToRerun: true,
    })
    expect(plan.items.find((i) => i.id === 'custom-human')).toMatchObject({
      classification: 'human-edited',
      safeToRerun: false,
    })
  })
})

describe('isSymptomSafeToRerun (execution-time re-check)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('is safe for a base symptom with no override content, without querying history', async () => {
    const safe = await isSymptomSafeToRerun({
      symptomId: 'base-1',
      kind: 'base',
      currentBrief: null,
      currentHtml: null,
    })
    expect(safe).toBe(true)
    expect(mockedHistoryFindMany).not.toHaveBeenCalled()
  })

  it('is safe when current content matches an AI output', async () => {
    mockedHistoryFindMany.mockResolvedValueOnce([
      {
        modelUsed: 'gpt-4o-mini',
        newBriefInstruction: 'AI brief',
        newInstructionsHtml: '<p>AI instructions</p>',
      },
    ])
    const safe = await isSymptomSafeToRerun({
      symptomId: 'base-1',
      kind: 'base',
      currentBrief: 'AI brief',
      currentHtml: '<p>AI instructions</p>',
    })
    expect(safe).toBe(true)
  })

  it('is unsafe when current content was edited since the AI run', async () => {
    mockedHistoryFindMany.mockResolvedValueOnce([
      {
        modelUsed: 'gpt-4o-mini',
        newBriefInstruction: 'AI brief',
        newInstructionsHtml: '<p>AI instructions</p>',
      },
    ])
    const safe = await isSymptomSafeToRerun({
      symptomId: 'base-1',
      kind: 'base',
      currentBrief: 'Hand-tuned brief',
      currentHtml: '<p>AI instructions</p>',
    })
    expect(safe).toBe(false)
  })

  it('is unsafe for a custom symptom with no AI history', async () => {
    mockedHistoryFindMany.mockResolvedValueOnce([])
    const safe = await isSymptomSafeToRerun({
      symptomId: 'custom-1',
      kind: 'custom',
      currentBrief: null,
      currentHtml: null,
    })
    expect(safe).toBe(false)
  })
})
