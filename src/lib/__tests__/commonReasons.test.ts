import { getCommonReasonsForSurgery, COMMON_REASONS_MAX } from '@/lib/commonReasons'
import { FALLBACK_SYMPTOM_NAMES, resolveFallbackCommonReasonSymptoms } from '@/lib/commonReasonsShared'
import type { EffectiveSymptom } from '@/server/effectiveSymptoms'

const makeSymptom = (name: string, overrides: Partial<EffectiveSymptom> = {}): EffectiveSymptom => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  ageGroup: 'Adult',
  briefInstruction: null,
  highlightedText: null,
  instructions: null,
  instructionsJson: null,
  instructionsHtml: null,
  linkToPage: null,
  source: 'base',
  ...overrides,
})

// All eight fallback names exist as symptoms
const fallbackSymptoms = FALLBACK_SYMPTOM_NAMES.map(name => makeSymptom(name))

describe('getCommonReasonsForSurgery', () => {
  describe('no explicit config (unset state)', () => {
    it('returns the default fallback buttons when uiConfig is null', () => {
      const result = getCommonReasonsForSurgery(null, fallbackSymptoms)
      expect(result.length).toBe(COMMON_REASONS_MAX)
      expect(result.map(r => r.symptom.name)).toEqual(
        FALLBACK_SYMPTOM_NAMES.slice(0, COMMON_REASONS_MAX)
      )
    })

    it('returns the fallback buttons when uiConfig has no commonReasons key', () => {
      const result = getCommonReasonsForSurgery({}, fallbackSymptoms)
      expect(result.length).toBe(COMMON_REASONS_MAX)
    })

    it('returns the fallback buttons when commonReasonsEnabled is not a boolean', () => {
      const result = getCommonReasonsForSurgery(
        { commonReasons: {} as never },
        fallbackSymptoms
      )
      expect(result.length).toBe(COMMON_REASONS_MAX)
    })

    it('matches fallback names case-insensitively and skips hidden symptoms', () => {
      const symptoms = [
        makeSymptom('abdomen pain'),
        makeSymptom('Cough', { isHidden: true }),
        makeSymptom('Sore Throat'),
      ]
      const result = getCommonReasonsForSurgery(null, symptoms)
      expect(result.map(r => r.symptom.name)).toEqual(['abdomen pain', 'Sore Throat'])
    })

    it('caps the fallback list at COMMON_REASONS_MAX', () => {
      expect(FALLBACK_SYMPTOM_NAMES.length).toBeGreaterThan(COMMON_REASONS_MAX)
      const result = getCommonReasonsForSurgery(undefined, fallbackSymptoms)
      expect(result.length).toBe(COMMON_REASONS_MAX)
    })
  })

  describe('explicitly disabled', () => {
    it('returns nothing when commonReasonsEnabled is false', () => {
      const result = getCommonReasonsForSurgery(
        { commonReasons: { commonReasonsEnabled: false } },
        fallbackSymptoms
      )
      expect(result).toEqual([])
    })
  })

  describe('explicitly enabled', () => {
    const configured = [makeSymptom('Rash'), makeSymptom('Headache'), makeSymptom('Back Pain')]

    it('returns the configured items in order with labels', () => {
      const result = getCommonReasonsForSurgery(
        {
          commonReasons: {
            commonReasonsEnabled: true,
            items: [
              { symptomId: 'headache', label: 'Head pain' },
              { symptomId: 'rash' },
            ],
          },
        },
        [...fallbackSymptoms, ...configured]
      )
      expect(result.map(r => ({ name: r.symptom.name, label: r.label }))).toEqual([
        { name: 'Headache', label: 'Head pain' },
        { name: 'Rash', label: undefined },
      ])
    })

    it('returns nothing (no fallback) when enabled with no items', () => {
      const result = getCommonReasonsForSurgery(
        { commonReasons: { commonReasonsEnabled: true, items: [] } },
        fallbackSymptoms
      )
      expect(result).toEqual([])
    })

    it('skips hidden and unknown symptoms without falling back', () => {
      const result = getCommonReasonsForSurgery(
        {
          commonReasons: {
            commonReasonsEnabled: true,
            items: [{ symptomId: 'missing' }, { symptomId: 'hidden-one' }],
          },
        },
        [...fallbackSymptoms, makeSymptom('Hidden One', { isHidden: true })]
      )
      expect(result).toEqual([])
    })

    it('supports the legacy commonReasonsSymptomIds format', () => {
      const result = getCommonReasonsForSurgery(
        {
          commonReasons: {
            commonReasonsEnabled: true,
            commonReasonsSymptomIds: ['rash', 'headache'],
          },
        },
        configured
      )
      expect(result.map(r => r.symptom.name)).toEqual(['Rash', 'Headache'])
    })
  })
})

describe('resolveFallbackCommonReasonSymptoms', () => {
  it('agrees with the staff-facing fallback resolution', () => {
    const symptoms = [...fallbackSymptoms, makeSymptom('Unrelated')]
    const shared = resolveFallbackCommonReasonSymptoms(symptoms)
    const staffFacing = getCommonReasonsForSurgery(null, symptoms)
    expect(shared.map(s => s.id)).toEqual(staffFacing.map(r => r.symptom.id))
  })
})
