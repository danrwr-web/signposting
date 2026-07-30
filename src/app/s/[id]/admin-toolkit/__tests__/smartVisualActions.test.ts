import {
  saveAdminToolkitSmartVisual,
  removeAdminToolkitSmartVisual,
} from '@/app/s/[id]/admin-toolkit/smartVisualActions'
import { requireAdminToolkitItemEdit } from '@/server/adminToolkitGates'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { getAdminToolkitPageItem } from '@/server/adminToolkit'
import { computeSmartVisualFingerprint } from '@/server/adminToolkitSmartVisual'
import { prisma } from '@/lib/prisma'
import type { AdminToolkitPageItem } from '@/server/adminToolkit'

jest.mock('@/server/adminToolkitGates', () => ({
  requireAdminToolkitItemEdit: jest.fn(),
  zodFieldErrors: (error: { issues: Array<{ path: PropertyKey[]; message: string }> }) => {
    const result: Record<string, string> = {}
    for (const issue of error.issues) {
      const key = issue.path.map(String).join('.') || 'root'
      if (!result[key]) result[key] = issue.message
    }
    return result
  },
}))

jest.mock('@/lib/features', () => ({
  isFeatureEnabledForSurgery: jest.fn(),
}))

jest.mock('@/server/adminToolkit', () => ({
  getAdminToolkitPageItem: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    adminItemSmartVisual: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    adminHistory: { create: jest.fn() },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
  },
}))

const mockedGate = requireAdminToolkitItemEdit as jest.Mock
const mockedFlag = isFeatureEnabledForSurgery as jest.Mock
const mockedGetItem = getAdminToolkitPageItem as jest.Mock
const mockedUpsert = prisma.adminItemSmartVisual.upsert as jest.Mock
const mockedFindUnique = prisma.adminItemSmartVisual.findUnique as jest.Mock
const mockedFindFirst = prisma.adminItemSmartVisual.findFirst as jest.Mock
const mockedDeleteMany = prisma.adminItemSmartVisual.deleteMany as jest.Mock
const mockedHistoryCreate = prisma.adminHistory.create as jest.Mock
const mockedTransaction = prisma.$transaction as jest.Mock

const item: AdminToolkitPageItem = {
  id: 'item-1',
  type: 'PAGE',
  title: 'Fire safety',
  categoryId: null,
  warningLevel: null,
  contentHtml: null,
  contentJson: { blocks: [{ type: 'INTRO_TEXT', html: '<p>Intro.</p>' }] },
  lastReviewedAt: null,
  updatedAt: new Date(),
  createdAt: new Date(),
  ownerUserId: null,
  editors: [],
  editGrants: [],
  attachments: [],
}

const layout = { version: 1, sections: [{ type: 'summary', text: 'A summary.' }] }
const fingerprint = computeSmartVisualFingerprint(item)

const validInput = {
  surgeryId: 'surgery-1',
  itemId: 'item-1',
  layout,
  sourceFingerprint: fingerprint,
  modelUsed: 'gpt-4o-mini',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockedGate.mockResolvedValue({
    ok: true,
    data: { surgeryId: 'surgery-1', itemId: 'item-1', userId: 'user-1', canManage: true, isSuperuser: false },
  })
  mockedFlag.mockResolvedValue(true)
  mockedGetItem.mockResolvedValue(item)
  mockedFindUnique.mockResolvedValue(null)
  mockedFindFirst.mockResolvedValue({ id: 'sv-1' })
  mockedUpsert.mockResolvedValue({ id: 'sv-1' })
  mockedDeleteMany.mockResolvedValue({ count: 1 })
  mockedHistoryCreate.mockResolvedValue({ id: 'hist-1' })
})

describe('saveAdminToolkitSmartVisual', () => {
  it('saves the visual with a server-computed fingerprint and writes an audit row in one transaction', async () => {
    const result = await saveAdminToolkitSmartVisual(validInput)

    expect(result.ok).toBe(true)
    expect(mockedTransaction).toHaveBeenCalledTimes(1)
    expect(mockedUpsert).toHaveBeenCalledTimes(1)
    const upsertArgs = mockedUpsert.mock.calls[0][0]
    expect(upsertArgs.where).toEqual({ adminItemId: 'item-1' })
    expect(upsertArgs.create.sourceFingerprint).toBe(fingerprint)
    expect(upsertArgs.create.generatedByUserId).toBe('user-1')
    expect(mockedHistoryCreate).toHaveBeenCalledTimes(1)
    expect(mockedHistoryCreate.mock.calls[0][0].data).toMatchObject({
      action: 'SMART_VISUAL_SAVE',
      entityType: 'ADMIN_ITEM',
      adminItemId: 'item-1',
      actorUserId: 'user-1',
    })
  })

  it('rejects an invalid layout blob without touching the database', async () => {
    const result = await saveAdminToolkitSmartVisual({
      ...validInput,
      layout: { version: 1, sections: [{ type: 'bogus' }] },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(mockedUpsert).not.toHaveBeenCalled()
  })

  it('rejects with STALE when the item content changed since generation', async () => {
    mockedGetItem.mockResolvedValue({ ...item, title: 'Fire safety v2' })

    const result = await saveAdminToolkitSmartVisual(validInput)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('STALE')
    expect(mockedUpsert).not.toHaveBeenCalled()
  })

  it('is blocked when the feature flag is off', async () => {
    mockedFlag.mockResolvedValue(false)

    const result = await saveAdminToolkitSmartVisual(validInput)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FEATURE_DISABLED')
    expect(mockedUpsert).not.toHaveBeenCalled()
  })

  it('lets a superuser save even when the feature flag is off', async () => {
    mockedFlag.mockResolvedValue(false)
    mockedGate.mockResolvedValue({
      ok: true,
      data: { surgeryId: 'surgery-1', itemId: 'item-1', userId: 'super-1', canManage: true, isSuperuser: true },
    })

    const result = await saveAdminToolkitSmartVisual(validInput)

    expect(result.ok).toBe(true)
    expect(mockedUpsert).toHaveBeenCalledTimes(1)
  })

  it('is blocked when the edit gate fails', async () => {
    mockedGate.mockResolvedValue({ ok: false, error: { code: 'FORBIDDEN', message: 'No permission.' } })

    const result = await saveAdminToolkitSmartVisual(validInput)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN')
    expect(mockedUpsert).not.toHaveBeenCalled()
  })
})

describe('removeAdminToolkitSmartVisual', () => {
  it('deletes the visual and writes an audit row', async () => {
    const result = await removeAdminToolkitSmartVisual({ surgeryId: 'surgery-1', itemId: 'item-1' })

    expect(result.ok).toBe(true)
    expect(mockedDeleteMany).toHaveBeenCalledWith({ where: { adminItemId: 'item-1', surgeryId: 'surgery-1' } })
    expect(mockedHistoryCreate.mock.calls[0][0].data).toMatchObject({ action: 'SMART_VISUAL_REMOVE' })
  })

  it('is idempotent when no visual exists', async () => {
    mockedFindFirst.mockResolvedValue(null)

    const result = await removeAdminToolkitSmartVisual({ surgeryId: 'surgery-1', itemId: 'item-1' })

    expect(result.ok).toBe(true)
    expect(mockedDeleteMany).not.toHaveBeenCalled()
    expect(mockedHistoryCreate).not.toHaveBeenCalled()
  })

  it('is blocked when the edit gate fails', async () => {
    mockedGate.mockResolvedValue({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'Sign in.' } })

    const result = await removeAdminToolkitSmartVisual({ surgeryId: 'surgery-1', itemId: 'item-1' })

    expect(result.ok).toBe(false)
    expect(mockedDeleteMany).not.toHaveBeenCalled()
  })
})
