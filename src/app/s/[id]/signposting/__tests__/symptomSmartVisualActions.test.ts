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
import { updateRequiresClinicalReview } from '@/server/updateRequiresClinicalReview'
import { prisma } from '@/lib/prisma'
import type { EffectiveSymptom } from '@/server/effectiveSymptoms'

jest.mock('@/server/symptomSmartVisualGates', () => ({
  requireSymptomSmartVisualEdit: jest.fn(),
}))

jest.mock('@/server/updateRequiresClinicalReview', () => ({
  updateRequiresClinicalReview: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    symptomSmartVisual: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    symptomHistory: { create: jest.fn() },
    symptomReviewStatus: { upsert: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}))

const mockedGate = requireSymptomSmartVisualEdit as jest.Mock
const mockedUpsert = prisma.symptomSmartVisual.upsert as jest.Mock
const mockedDeleteMany = prisma.symptomSmartVisual.deleteMany as jest.Mock
const mockedHistoryCreate = prisma.symptomHistory.create as jest.Mock
const mockedReviewUpsert = prisma.symptomReviewStatus.upsert as jest.Mock
const mockedTransaction = prisma.$transaction as jest.Mock
const mockedRecount = updateRequiresClinicalReview as jest.Mock

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
  mockedReviewUpsert.mockResolvedValue({ id: 'srs-1' })
  mockedRecount.mockResolvedValue(undefined)
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
    expect(mockedReviewUpsert).toHaveBeenCalledTimes(1)
    expect(mockedReviewUpsert.mock.calls[0][0]).toMatchObject({
      where: {
        surgeryId_symptomId_ageGroup: {
          surgeryId: 'surgery-1',
          symptomId: 'sym-1',
          ageGroup: 'Adult',
        },
      },
      update: { status: 'PENDING', lastReviewedAt: null },
    })
  })

  it('resets the approval INSIDE the same transaction as the visual write', async () => {
    // If these could commit separately, a failure between them would publish an
    // AI reinterpretation still carrying its old APPROVED status.
    await saveSymptomSmartVisual(validInput)

    expect(mockedTransaction).toHaveBeenCalledTimes(1)
    expect(mockedTransaction.mock.calls[0][0]).toHaveLength(3)
    // Every write was issued while building the transaction's operation list,
    // so none of them can be committed without the others.
    for (const mock of [mockedUpsert, mockedHistoryCreate, mockedReviewUpsert]) {
      expect(mock).toHaveBeenCalledTimes(1)
    }
  })

  it('never leaves the symptom approved when the transaction fails', async () => {
    mockedTransaction.mockRejectedValueOnce(new Error('connection dropped'))

    const result = await saveSymptomSmartVisual(validInput)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('UNKNOWN')
    // The whole transaction rolls back together, so neither the visual nor the
    // approval reset lands — and the post-commit recount never runs.
    expect(mockedRecount).not.toHaveBeenCalled()
  })

  it('still reports success when only the post-commit recount fails', async () => {
    // The approval reset is already committed at this point, so the symptom is
    // correctly Pending — only the surgery-level banner count lags. Reporting a
    // failed save here would be misleading and would stop the client refreshing.
    mockedRecount.mockRejectedValueOnce(new Error('recount failed'))

    const result = await saveSymptomSmartVisual(validInput)

    expect(result.ok).toBe(true)
    expect(mockedReviewUpsert).toHaveBeenCalledTimes(1)
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
    expect(mockedReviewUpsert).not.toHaveBeenCalled()
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
    expect(mockedReviewUpsert).not.toHaveBeenCalled()
  })

  it('is blocked when the gate fails (flag off, not an admin, symptom missing)', async () => {
    for (const code of ['FEATURE_DISABLED', 'FORBIDDEN', 'NOT_FOUND', 'UNAUTHENTICATED']) {
      jest.clearAllMocks()
      mockedGate.mockResolvedValue({ ok: false, error: { code, message: 'nope' } })

      const result = await saveSymptomSmartVisual(validInput)

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe(code)
      expect(mockedUpsert).not.toHaveBeenCalled()
      expect(mockedReviewUpsert).not.toHaveBeenCalled()
    }
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

    expect(mockedReviewUpsert).not.toHaveBeenCalled()
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
