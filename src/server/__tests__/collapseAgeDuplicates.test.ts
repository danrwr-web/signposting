import { buildCollapsePlan } from '@/server/collapseAgeDuplicates'
import { EffectiveSymptom } from '@/server/effectiveSymptoms'

jest.mock('@/lib/prisma', () => ({
  prisma: {},
}))

jest.mock('@/server/effectiveSymptoms', () => ({
  getEffectiveSymptoms: jest.fn(),
}))

function makeSymptom(overrides: Partial<EffectiveSymptom> & { id: string; name: string; ageGroup: 'U5' | 'O5' | 'Adult' }): EffectiveSymptom {
  return {
    slug: overrides.id,
    briefInstruction: null,
    highlightedText: null,
    instructions: null,
    instructionsJson: null,
    instructionsHtml: null,
    linkToPage: null,
    source: 'base',
    ...overrides,
  } as EffectiveSymptom
}

const noEdits = new Map<string, Date | null>()

describe('buildCollapsePlan', () => {
  it('keeps the Adult version when no version is locally edited', () => {
    const plan = buildCollapsePlan([
      makeSymptom({ id: 'u5', name: 'Cough', ageGroup: 'U5' }),
      makeSymptom({ id: 'o5', name: 'Cough', ageGroup: 'O5' }),
      makeSymptom({ id: 'adult', name: 'Cough', ageGroup: 'Adult' }),
    ], noEdits)

    expect(plan.counts).toEqual({ duplicateGroups: 1, disabledCount: 2, keptCount: 1 })
    expect(plan.groups[0].kept).toMatchObject({ baseSymptomId: 'adult', ageGroup: 'Adult' })
    expect(plan.groups[0].reason).toBe('age-preference')
    expect(plan.groups[0].disabled.map(d => d.baseSymptomId).sort()).toEqual(['o5', 'u5'])
  })

  it('falls back to O5 then U5 when there is no Adult version', () => {
    const plan = buildCollapsePlan([
      makeSymptom({ id: 'u5', name: 'Croup', ageGroup: 'U5' }),
      makeSymptom({ id: 'o5', name: 'Croup', ageGroup: 'O5' }),
    ], noEdits)

    expect(plan.groups[0].kept.baseSymptomId).toBe('o5')
    expect(plan.groups[0].disabled.map(d => d.baseSymptomId)).toEqual(['u5'])
  })

  it('prefers a locally-edited (override) version over the Adult version', () => {
    const plan = buildCollapsePlan([
      makeSymptom({ id: 'u5', name: 'Cough', ageGroup: 'U5', source: 'override', baseSymptomId: 'u5' }),
      makeSymptom({ id: 'adult', name: 'Cough', ageGroup: 'Adult' }),
    ], new Map([['u5', new Date('2026-06-01')]]))

    expect(plan.groups[0].kept.baseSymptomId).toBe('u5')
    expect(plan.groups[0].reason).toBe('override')
  })

  it('keeps the most recently edited version when several are edited', () => {
    const plan = buildCollapsePlan([
      makeSymptom({ id: 'u5', name: 'Cough', ageGroup: 'U5', source: 'override', baseSymptomId: 'u5' }),
      makeSymptom({ id: 'adult', name: 'Cough', ageGroup: 'Adult', source: 'override', baseSymptomId: 'adult' }),
    ], new Map([
      ['u5', new Date('2026-06-15')],
      ['adult', new Date('2026-06-01')],
    ]))

    expect(plan.groups[0].kept.baseSymptomId).toBe('u5')
    expect(plan.groups[0].reason).toBe('latest-override')
  })

  it('breaks edited ties (null edit times) by age preference', () => {
    const plan = buildCollapsePlan([
      makeSymptom({ id: 'u5', name: 'Cough', ageGroup: 'U5', source: 'override', baseSymptomId: 'u5' }),
      makeSymptom({ id: 'adult', name: 'Cough', ageGroup: 'Adult', source: 'override', baseSymptomId: 'adult' }),
    ], new Map([['u5', null], ['adult', null]]))

    expect(plan.groups[0].kept.baseSymptomId).toBe('adult')
  })

  it('groups by effective display name, trimmed and case-insensitive', () => {
    const plan = buildCollapsePlan([
      makeSymptom({ id: 'a', name: 'Sore throat ', ageGroup: 'Adult' }),
      makeSymptom({ id: 'b', name: 'sore Throat', ageGroup: 'U5' }),
    ], noEdits)

    expect(plan.counts.duplicateGroups).toBe(1)
    expect(plan.groups[0].kept.baseSymptomId).toBe('a')
  })

  it('never disables custom symptoms and reports skipped groups', () => {
    const plan = buildCollapsePlan([
      makeSymptom({ id: 'base-adult', name: 'Rash', ageGroup: 'Adult' }),
      makeSymptom({ id: 'custom-1', name: 'Rash', ageGroup: 'U5', source: 'custom' }),
    ], noEdits)

    expect(plan.groups).toHaveLength(0)
    expect(plan.counts.disabledCount).toBe(0)
    expect(plan.skippedCustomDuplicates).toEqual(['Rash'])
  })

  it('is idempotent: an already-collapsed library produces an empty plan', () => {
    const plan = buildCollapsePlan([
      makeSymptom({ id: 'a', name: 'Cough', ageGroup: 'Adult' }),
      makeSymptom({ id: 'b', name: 'Earache', ageGroup: 'U5' }),
    ], noEdits)

    expect(plan.groups).toHaveLength(0)
    expect(plan.counts).toEqual({ duplicateGroups: 0, disabledCount: 0, keptCount: 0 })
    expect(plan.skippedCustomDuplicates).toHaveLength(0)
  })
})
