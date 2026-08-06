import {
  saveSymptomSmartVisual,
  removeSymptomSmartVisual,
} from '@/app/s/[id]/signposting/symptomSmartVisualActions'
import { requireSymptomSmartVisualEdit } from '@/server/symptomSmartVisualGates'
import {
  computeSymptomSmartVisualFingerprint,
  resolveSymptomVariant,
  MAIN_VARIANT_KEY,
} from '@/server/symptomSmartVisual'
import { markSymptomPendingReview } from '@/server/clinicalReview'
import { prisma } from '@/lib/prisma'
import type { EffectiveSymptom } from '@/server/effectiveSymptoms'

jest.mock('@/server/symptomSmartVisualGates', () => ({
  requireSymptomSmartVisualEdit: jest.fn(),
}))

jest.mock('@/server/clinicalReview', () => ({
  markSymptomPendingReview: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    symptomSmartVisual: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    symptomHistory: { create: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}))

const mockedGate = requireSymptomSmartVisualEdit as jest.Mock
const mockedUpsert = prisma.symptomSmartVisual.upsert as jest.Mock
const mockedDeleteMany = prisma.symptomSmartVisual.deleteMany as jest.Mock
const mockedHistoryCreate = prisma.symptomHistory.create as jest.Mock
const mockedTransaction = prisma.$transaction as jest.Mock
const mockedMarkPending = markSymptomPendingReview as jest.Mock

const symptom: EffectiveSymptom = {
  id: 'sym-1',
  slug: 'earache',
  name: 'Earache',
  ageGroup: 'Adult',
  briefInstruction: 'Green Slot',
  highlightedText: null,
  instructions: null,
  instructionsJson: null,
  instructionsHtml: '<p>Offer a Green Slot with the ANP.</p>',
  linkToPage: null,
  linkToPages: null,
  source: 'override',
  baseSymptomId: 'sym-1',
}

const variant = resolveSymptomVariant(symptom, MAIN_VARIANT_KEY)!
const fingerprint = computeSymptomSmartVisualFingerprint(symptom, variant)

const layout = {
  version: 1,
  sections: [{ type: 'redFlags', action: 'Call 999 immediately', flags: ['Neck stiffness'] }],
}

const validInput = {
  surgeryId: 'surgery-1',
  symptomId: 'sym-1',
  variantKey: '',
  layout,
  sourceFingerprint: fingerprint,
  modelUsed: 'gpt-4o-mini',
}

const gateOk = (overrides: Record<string, unknown> = {}) => ({
  ok: true,
  data: {
    userId: 'user-1',
    userEmail: 'admin@example.nhs.uk',
    isSuperuser: false,
    symptom,
    symptomKeyId: 'sym-1',
    variant,
    ...overrides,
  },
})

beforeEach(() => {
  jest.clearAllMocks()
  mockedGate.mockResolvedValue(gateOk())
  mockedUpsert.mockResolvedValue({ id: 'svv-1' })
  mockedDeleteMany.mockResolvedValue({ count: 1 })
  mockedHistoryCreate.mockResolvedValue({ id: 'hist-1' })
  mockedMarkPending.mockResolvedValue(undefined)
})

describe('saveSymptomSmartVisual', () => {
  it('saves with a server-recomputed fingerprint and writes the audit row in one transaction', async () => {
    const result = await saveSymptomSmartVisual(validInput)

    expect(result.ok).toBe(true)
    expect(mockedTransaction).toHaveBeenCalledTimes(1)
    expect(mockedUpsert).toHaveBeenCalledTimes(1)

    const upsertArgs = mockedUpsert.mock.calls[0][0]
    expect(upsertArgs.where).toEqual({
      surgeryId_symptomId_variantKey: { surgeryId: 'surgery-1', symptomId: 'sym-1', variantKey: '' },
    })
    expect(upsertArgs.create.sourceFingerprint).toBe(fingerprint)
    expect(upsertArgs.create.generatedByUserId).toBe('user-1')

    expect(mockedHistoryCreate).toHaveBeenCalledTimes(1)
    expect(mockedHistoryCreate.mock.calls[0][0].data).toMatchObject({
      symptomId: 'sym-1',
      source: 'override',
      editorEmail: 'admin@example.nhs.uk',
      modelUsed: 'gpt-4o-mini',
    })
    expect(mockedHistoryCreate.mock.calls[0][0].data.newText).toContain('redFlags')
  })

  it('sends the symptom back for clinical review — the governance rule for signposting visuals', async () => {
    const result = await saveSymptomSmartVisual(validInput)

    expect(result.ok).toBe(true)
    expect(mockedMarkPending).toHaveBeenCalledTimes(1)
    expect(mockedMarkPending).toHaveBeenCalledWith('surgery-1', 'sym-1', 'Adult')
  })

  it('records "unknown-model" rather than dropping AI attribution when the model is missing', async () => {
    const { modelUsed, ...withoutModel } = validInput
    const result = await saveSymptomSmartVisual(withoutModel)

    expect(result.ok).toBe(true)
    expect(mockedHistoryCreate.mock.calls[0][0].data.modelUsed).toBe('unknown-model')
  })

  it('keys the visual by the variant when one is selected', async () => {
    const variantSymptom: EffectiveSymptom = {
      ...symptom,
      variants: {
        ageGroups: [{ key: 'u5', label: 'Under 5', instructions: '<p>Same-day call.</p>' }],
      },
    }
    const u5 = resolveSymptomVariant(variantSymptom, 'u5')!
    mockedGate.mockResolvedValue(gateOk({ symptom: variantSymptom, variant: u5 }))

    const result = await saveSymptomSmartVisual({
      ...validInput,
      variantKey: 'u5',
      sourceFingerprint: computeSymptomSmartVisualFingerprint(variantSymptom, u5),
    })

    expect(result.ok).toBe(true)
    expect(mockedUpsert.mock.calls[0][0].where.surgeryId_symptomId_variantKey.variantKey).toBe('u5')
    expect(mockedHistoryCreate.mock.calls[0][0].data.newText).toContain('for Under 5')
  })

  it('rejects an invalid layout blob without touching the database', async () => {
    const result = await saveSymptomSmartVisual({
      ...validInput,
      layout: { version: 1, sections: [{ type: 'bogus' }] },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(mockedUpsert).not.toHaveBeenCalled()
    expect(mockedMarkPending).not.toHaveBeenCalled()
  })

  it('rejects a layout the client dressed up with HTML that empties a required field', async () => {
    const result = await saveSymptomSmartVisual({
      ...validInput,
      layout: { version: 1, sections: [{ type: 'summary', text: '<span></span>' }] },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(mockedUpsert).not.toHaveBeenCalled()
  })

  it('rejects with STALE when the instructions changed since generation', async () => {
    const result = await saveSymptomSmartVisual({
      ...validInput,
      sourceFingerprint: 'f'.repeat(64),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('STALE')
    expect(mockedUpsert).not.toHaveBeenCalled()
    expect(mockedMarkPending).not.toHaveBeenCalled()
  })

  it('is blocked when the gate fails (flag off, not an admin, symptom missing)', async () => {
    for (const code of ['FEATURE_DISABLED', 'FORBIDDEN', 'NOT_FOUND', 'UNAUTHENTICATED']) {
      jest.clearAllMocks()
      mockedGate.mockResolvedValue({ ok: false, error: { code, message: 'nope' } })

      const result = await saveSymptomSmartVisual(validInput)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe(code)
      expect(mockedUpsert).not.toHaveBeenCalled()
      expect(mockedMarkPending).not.toHaveBeenCalled()
    }
  })

  it('does not report success when the write fails', async () => {
    mockedTransaction.mockRejectedValueOnce(new Error('db down'))

    const result = await saveSymptomSmartVisual(validInput)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('UNKNOWN')
    expect(mockedMarkPending).not.toHaveBeenCalled()
  })
})

describe('removeSymptomSmartVisual', () => {
  it('deletes the visual for the selected variant and writes an audit row', async () => {
    const result = await removeSymptomSmartVisual({
      surgeryId: 'surgery-1',
      symptomId: 'sym-1',
      variantKey: '',
    })

    expect(result.ok).toBe(true)
    expect(mockedDeleteMany).toHaveBeenCalledWith({
      where: { surgeryId: 'surgery-1', symptomId: 'sym-1', variantKey: '' },
    })
    expect(mockedHistoryCreate.mock.calls[0][0].data.newText).toContain('Removed smart visual')
  })

  it('does not re-trigger clinical review — removing only takes a view away', async () => {
    await removeSymptomSmartVisual({ surgeryId: 'surgery-1', symptomId: 'sym-1' })

    expect(mockedMarkPending).not.toHaveBeenCalled()
  })

  it('is idempotent when no visual exists', async () => {
    mockedDeleteMany.mockResolvedValue({ count: 0 })

    const result = await removeSymptomSmartVisual({ surgeryId: 'surgery-1', symptomId: 'sym-1' })

    expect(result.ok).toBe(true)
    expect(mockedHistoryCreate).not.toHaveBeenCalled()
  })

  it('is blocked when the gate fails', async () => {
    mockedGate.mockResolvedValue({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Only practice admins can create smart visuals.' },
    })

    const result = await removeSymptomSmartVisual({ surgeryId: 'surgery-1', symptomId: 'sym-1' })

    expect(result.ok).toBe(false)
    expect(mockedDeleteMany).not.toHaveBeenCalled()
  })
})
