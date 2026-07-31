import {
  getEffectiveSymptoms,
  getCachedEffectiveSymptoms,
  getEffectiveSymptomById,
  getEffectiveSymptomBySlug,
  getEffectiveSymptomByName,
  resolveLinkToPages,
  mergeLinkToPages,
} from '@/server/effectiveSymptoms'
import { prisma } from '@/lib/prisma'

jest.mock('next/cache', () => ({
  unstable_cache: (fn: any) => fn,
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    baseSymptom: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
    surgerySymptomOverride: { findMany: jest.fn(), findUnique: jest.fn() },
    surgeryCustomSymptom: { findMany: jest.fn(), findFirst: jest.fn() },
    surgerySymptomStatus: { findMany: jest.fn() },
  },
}))

const baseGout = {
  id: 'base-gout',
  slug: 'gout',
  name: 'Gout',
  ageGroup: 'Adult',
  briefInstruction: 'Pink/Purple telephone slot',
  highlightedText: null,
  instructions: 'Base instructions',
  instructionsJson: null,
  instructionsHtml: '<p>Base instructions</p>',
  linkToPage: null,
  variants: null,
}

const overrideRow = (briefInstruction: string | null) => ({
  baseSymptomId: 'base-gout',
  name: null,
  ageGroup: null,
  briefInstruction,
  highlightedText: null,
  instructions: null,
  instructionsJson: null,
  instructionsHtml: null,
  linkToPage: null,
  isHidden: false,
})

describe('effectiveSymptoms tri-state briefInstruction merge', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getEffectiveSymptoms (buildEffectiveSymptoms)', () => {
    const setup = (override: any) => {
      ;(prisma.$transaction as jest.Mock).mockResolvedValueOnce([
        [baseGout],
        override ? [override] : [],
        [],
        [],
      ])
    }

    it('NULL override briefInstruction inherits from base', async () => {
      setup(overrideRow(null))
      const result = await getEffectiveSymptoms('surgery-imperial')
      expect(result).toHaveLength(1)
      expect(result[0].briefInstruction).toBe('Pink/Purple telephone slot')
      expect(result[0].source).toBe('override')
    })

    it('empty-string override briefInstruction is used as explicit blank', async () => {
      setup(overrideRow(''))
      const result = await getEffectiveSymptoms('surgery-imperial')
      expect(result[0].briefInstruction).toBe('')
      expect(result[0].source).toBe('override')
    })

    it('non-empty override briefInstruction is used verbatim', async () => {
      setup(overrideRow('Imperial-specific guidance'))
      const result = await getEffectiveSymptoms('surgery-imperial')
      expect(result[0].briefInstruction).toBe('Imperial-specific guidance')
    })

    it('with no override row at all, returns base briefInstruction', async () => {
      setup(null)
      const result = await getEffectiveSymptoms('surgery-imperial')
      expect(result[0].briefInstruction).toBe('Pink/Purple telephone slot')
      expect(result[0].source).toBe('base')
    })
  })

  describe('variants tri-state merge (per-surgery overrides)', () => {
    const BASE_VARIANTS = {
      heading: 'By age',
      ageGroups: [{ key: 'u5', label: 'Under 5', instructions: '<p>Base U5</p>' }],
    }
    const SURGERY_VARIANTS = {
      ageGroups: [{ key: 'u5', label: 'Under 5', instructions: '<p>Local U5</p>' }],
    }

    const setup = (overrideVariants: unknown) => {
      ;(prisma.$transaction as jest.Mock).mockResolvedValueOnce([
        [{ ...baseGout, variants: BASE_VARIANTS }],
        [{ ...overrideRow(null), variants: overrideVariants }],
        [],
        [],
      ])
    }

    it('null override variants inherit the base variants', async () => {
      setup(null)
      const result = await getEffectiveSymptoms('surgery-imperial')
      expect(result[0].variants).toEqual(BASE_VARIANTS)
    })

    it('surgery variants replace the base variants', async () => {
      setup(SURGERY_VARIANTS)
      const result = await getEffectiveSymptoms('surgery-imperial')
      expect(result[0].variants).toEqual(SURGERY_VARIANTS)
    })

    it('empty ageGroups hides variants for the surgery (kept verbatim for the UI to treat as none)', async () => {
      setup({ ageGroups: [] })
      const result = await getEffectiveSymptoms('surgery-imperial')
      expect(result[0].variants).toEqual({ ageGroups: [] })
    })

    it('includes a custom symptom\'s own variants', async () => {
      ;(prisma.$transaction as jest.Mock).mockResolvedValueOnce([
        [],
        [],
        [{
          id: 'custom-1',
          slug: 'local-thing',
          name: 'Local Thing',
          ageGroup: 'Adult',
          briefInstruction: null,
          highlightedText: null,
          instructions: null,
          instructionsJson: null,
          instructionsHtml: '<p>Custom</p>',
          linkToPage: null,
          variants: SURGERY_VARIANTS,
        }],
        [],
      ])
      const result = await getEffectiveSymptoms('surgery-imperial')
      expect(result).toHaveLength(1)
      expect(result[0].source).toBe('custom')
      expect(result[0].variants).toEqual(SURGERY_VARIANTS)
    })

    it('getEffectiveSymptomById applies the same merge', async () => {
      ;(prisma.surgeryCustomSymptom.findFirst as jest.Mock).mockResolvedValueOnce(null)
      ;(prisma.baseSymptom.findUnique as jest.Mock).mockResolvedValueOnce({ ...baseGout, variants: BASE_VARIANTS })
      ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValueOnce({
        ...overrideRow(null),
        variants: SURGERY_VARIANTS,
      })

      const result = await getEffectiveSymptomById('base-gout', 'surgery-imperial')
      expect(result?.variants).toEqual(SURGERY_VARIANTS)
    })
  })

  describe('searchText computation', () => {
    const setup = (override: any) => {
      ;(prisma.$transaction as jest.Mock).mockResolvedValueOnce([
        [baseGout],
        override ? [override] : [],
        [],
        [],
      ])
    }

    it('derives searchText from the override HTML, not the inherited base markdown', async () => {
      setup({
        ...overrideRow(null),
        instructionsHtml: '<p>Refer to the <strong>community pharmacist</strong></p>',
      })
      const result = await getEffectiveSymptoms('surgery-imperial')
      expect(result[0].searchText).toContain('community pharmacist')
      // Effective legacy markdown is inherited base content ('Base instructions');
      // it must not appear in the search index when override HTML is displayed.
      expect(result[0].searchText).not.toContain('base instructions')
    })

    it('slim cached payload omits instructionsHtml but keeps a searchText built from it', async () => {
      setup({
        ...overrideRow(null),
        instructionsHtml: '<p>Refer to the <strong>community pharmacist</strong></p>',
      })
      const result = await getCachedEffectiveSymptoms('surgery-imperial')
      expect(result[0].instructionsHtml).toBeNull()
      expect(result[0].searchText).toContain('community pharmacist')
      expect(result[0].searchText).not.toContain('base instructions')
    })

    it('falls back to legacy markdown in searchText when no HTML exists anywhere', async () => {
      ;(prisma.$transaction as jest.Mock).mockResolvedValueOnce([
        [{ ...baseGout, instructionsHtml: null }],
        [],
        [],
        [],
      ])
      const result = await getCachedEffectiveSymptoms('surgery-imperial')
      expect(result[0].searchText).toContain('base instructions')
    })
  })

  describe('getEffectiveSymptomById', () => {
    const setupBase = () => {
      ;(prisma.surgeryCustomSymptom.findFirst as jest.Mock).mockResolvedValueOnce(null)
      ;(prisma.baseSymptom.findUnique as jest.Mock).mockResolvedValueOnce(baseGout)
    }

    it('NULL override briefInstruction inherits from base', async () => {
      setupBase()
      ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValueOnce(overrideRow(null))
      const result = await getEffectiveSymptomById('base-gout', 'surgery-imperial')
      expect(result?.briefInstruction).toBe('Pink/Purple telephone slot')
    })

    it('empty-string override briefInstruction is explicit blank', async () => {
      setupBase()
      ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValueOnce(overrideRow(''))
      const result = await getEffectiveSymptomById('base-gout', 'surgery-imperial')
      expect(result?.briefInstruction).toBe('')
    })

    it('non-empty override briefInstruction is used verbatim', async () => {
      setupBase()
      ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValueOnce(overrideRow('Imperial text'))
      const result = await getEffectiveSymptomById('base-gout', 'surgery-imperial')
      expect(result?.briefInstruction).toBe('Imperial text')
    })
  })

  describe('getEffectiveSymptomBySlug', () => {
    const setupBase = () => {
      ;(prisma.surgeryCustomSymptom.findFirst as jest.Mock).mockResolvedValueOnce(null)
      ;(prisma.baseSymptom.findUnique as jest.Mock).mockResolvedValueOnce(baseGout)
    }

    it('NULL override briefInstruction inherits from base', async () => {
      setupBase()
      ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValueOnce(overrideRow(null))
      const result = await getEffectiveSymptomBySlug('gout', 'surgery-imperial')
      expect(result?.briefInstruction).toBe('Pink/Purple telephone slot')
    })

    it('empty-string override briefInstruction is explicit blank', async () => {
      setupBase()
      ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValueOnce(overrideRow(''))
      const result = await getEffectiveSymptomBySlug('gout', 'surgery-imperial')
      expect(result?.briefInstruction).toBe('')
    })
  })

  describe('getEffectiveSymptomByName', () => {
    const setupBase = () => {
      ;(prisma.surgeryCustomSymptom.findFirst as jest.Mock).mockResolvedValueOnce(null)
      ;(prisma.baseSymptom.findFirst as jest.Mock).mockResolvedValueOnce(baseGout)
    }

    it('NULL override briefInstruction inherits from base', async () => {
      setupBase()
      ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValueOnce(overrideRow(null))
      const result = await getEffectiveSymptomByName('Gout', 'surgery-imperial')
      expect(result?.briefInstruction).toBe('Pink/Purple telephone slot')
    })

    it('empty-string override briefInstruction is explicit blank', async () => {
      setupBase()
      ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValueOnce(overrideRow(''))
      const result = await getEffectiveSymptomByName('Gout', 'surgery-imperial')
      expect(result?.briefInstruction).toBe('')
    })
  })

  describe('disabled flag (Hide disabled / count reconciliation)', () => {
    const disabledStatusRow = {
      id: 'status-1',
      baseSymptomId: 'base-gout',
      customSymptomId: null,
      isEnabled: false,
    }
    const setupTx = (statuses: any[]) => {
      ;(prisma.$transaction as jest.Mock).mockResolvedValueOnce([
        [baseGout],
        [], // no overrides
        [], // no customs
        statuses,
      ])
    }

    it('flags a disabled base symptom with disabled:true when includeDisabled is true', async () => {
      setupTx([disabledStatusRow])
      const result = await getEffectiveSymptoms('surgery-imperial', true)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('base-gout')
      expect(result[0].disabled).toBe(true)
    })

    it('excludes the disabled symptom entirely when includeDisabled is false', async () => {
      setupTx([disabledStatusRow])
      const result = await getEffectiveSymptoms('surgery-imperial', false)
      expect(result).toHaveLength(0)
    })

    it('marks an enabled symptom with disabled:false', async () => {
      setupTx([]) // no status rows => enabled
      const result = await getEffectiveSymptoms('surgery-imperial', true)
      expect(result).toHaveLength(1)
      expect(result[0].disabled).toBe(false)
    })

    it('flags a disabled symptom that also has an override', async () => {
      ;(prisma.$transaction as jest.Mock).mockResolvedValueOnce([
        [baseGout],
        [overrideRow('Imperial-specific guidance')],
        [],
        [disabledStatusRow],
      ])
      const result = await getEffectiveSymptoms('surgery-imperial', true)
      expect(result).toHaveLength(1)
      expect(result[0].source).toBe('override')
      expect(result[0].disabled).toBe(true)
    })
  })
})

describe('related-symptom links (linkToPages)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('resolveLinkToPages', () => {
    it('prefers the JSON array and trims entries', () => {
      expect(resolveLinkToPages({ linkToPages: [' Chest pain ', 'Coughs'], linkToPage: 'Old' }))
        .toEqual(['Chest pain', 'Coughs'])
    })

    it('treats a stored empty array as explicitly no links', () => {
      expect(resolveLinkToPages({ linkToPages: [], linkToPage: 'Old' })).toEqual([])
    })

    it('falls back to the legacy single link when the array is unset', () => {
      expect(resolveLinkToPages({ linkToPages: null, linkToPage: 'Chest pain' })).toEqual(['Chest pain'])
      expect(resolveLinkToPages({ linkToPages: null, linkToPage: '  ' })).toBeNull()
      expect(resolveLinkToPages({ linkToPages: null, linkToPage: null })).toBeNull()
    })
  })

  describe('mergeLinkToPages', () => {
    const baseLinks = ['Chest pain', 'Breathing problems']

    it('null override inherits base links', () => {
      expect(mergeLinkToPages({ linkToPages: null, linkToPage: null }, baseLinks)).toEqual(baseLinks)
    })

    it('empty array override explicitly clears base links', () => {
      expect(mergeLinkToPages({ linkToPages: [], linkToPage: null }, baseLinks)).toEqual([])
    })

    it('non-empty override replaces base links', () => {
      expect(mergeLinkToPages({ linkToPages: ['Rashes'], linkToPage: null }, baseLinks)).toEqual(['Rashes'])
    })

    it('legacy override string replaces base links when the array is unset', () => {
      expect(mergeLinkToPages({ linkToPages: null, linkToPage: 'Rashes' }, baseLinks)).toEqual(['Rashes'])
      // Blank legacy value keeps the historical inherit behaviour.
      expect(mergeLinkToPages({ linkToPages: null, linkToPage: '' }, baseLinks)).toEqual(baseLinks)
    })
  })

  describe('through getEffectiveSymptoms', () => {
    const baseWithLinks = { ...baseGout, linkToPages: ['Chest pain', 'Breathing problems'] }
    const linkOverride = (linkToPages: any) => ({ ...overrideRow(null), linkToPages })

    const setup = (base: any, override: any) => {
      ;(prisma.$transaction as jest.Mock).mockResolvedValueOnce([
        [base],
        override ? [override] : [],
        [],
        [],
      ])
    }

    it('projects the array and mirrors the first entry into linkToPage', async () => {
      setup(baseWithLinks, null)
      const result = await getEffectiveSymptoms('surgery-imperial')
      expect(result[0].linkToPages).toEqual(['Chest pain', 'Breathing problems'])
      expect(result[0].linkToPage).toBe('Chest pain')
    })

    it('falls back to the legacy column for rows without the array', async () => {
      setup({ ...baseGout, linkToPage: 'Chest pain', linkToPages: null }, null)
      const result = await getEffectiveSymptoms('surgery-imperial')
      expect(result[0].linkToPages).toEqual(['Chest pain'])
      expect(result[0].linkToPage).toBe('Chest pain')
    })

    it('lets an override clear the base links with an empty array', async () => {
      setup(baseWithLinks, { ...linkOverride([]), linkToPage: null })
      const result = await getEffectiveSymptoms('surgery-imperial')
      expect(result[0].linkToPages).toEqual([])
      expect(result[0].linkToPage).toBeNull()
      expect(result[0].source).toBe('override')
    })

    it('lets an override replace the base links', async () => {
      setup(baseWithLinks, { ...linkOverride(['Rashes']), linkToPage: null })
      const result = await getEffectiveSymptoms('surgery-imperial')
      expect(result[0].linkToPages).toEqual(['Rashes'])
      expect(result[0].linkToPage).toBe('Rashes')
    })
  })
})
