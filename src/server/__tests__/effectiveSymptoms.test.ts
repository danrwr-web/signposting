import {
  getEffectiveSymptoms,
  getEffectiveSymptomById,
  getEffectiveSymptomBySlug,
  getEffectiveSymptomByName,
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
})
