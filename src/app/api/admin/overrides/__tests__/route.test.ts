import { NextRequest } from 'next/server'
import { POST } from '../route'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { markSymptomPendingReview } from '@/server/clinicalReview'

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
  requireSurgeryAdmin: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    surgery: {
      findUnique: jest.fn(),
    },
    baseSymptom: {
      findUnique: jest.fn(),
    },
    surgerySymptomOverride: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/server/clinicalReview', () => ({
  markSymptomPendingReview: jest.fn(),
}))

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}))

jest.mock('@/server/effectiveSymptoms', () => ({
  getCachedSymptomsTag: jest.fn((surgeryId: string, includeDisabled: boolean) =>
    `symptoms:${surgeryId}:${includeDisabled ? 'with-disabled' : 'enabled'}`
  ),
}))

const mockedRequireSurgeryAdmin = requireSurgeryAdmin as jest.MockedFunction<typeof requireSurgeryAdmin>

const createRequest = (body?: Record<string, unknown>): NextRequest =>
  ({
    json: async () => body,
  } as unknown as NextRequest)

describe('POST /api/admin/overrides', () => {
  beforeEach(() => {
    mockedRequireSurgeryAdmin.mockResolvedValue(undefined as any)
    ;(prisma.surgery.findUnique as jest.Mock).mockResolvedValue({ id: 'surgery-1' })
    ;(prisma.baseSymptom.findUnique as jest.Mock).mockResolvedValue({
      id: 'base-1',
      ageGroup: 'Adult',
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('marks the symptom pending review on a content edit, keyed by the base ageGroup', async () => {
    ;(prisma.surgerySymptomOverride.upsert as jest.Mock).mockResolvedValueOnce({
      surgeryId: 'surgery-1',
      baseSymptomId: 'base-1',
      ageGroup: null,
      briefInstruction: 'new advice',
    })

    const res = await POST(
      createRequest({
        surgeryId: 'surgery-1',
        baseId: 'base-1',
        briefInstruction: 'new advice',
      })
    )

    expect(res.status).toBe(200)
    expect(markSymptomPendingReview).toHaveBeenCalledWith('surgery-1', 'base-1', 'Adult')
  })

  it('keys the review reset by the override ageGroup when it differs from base', async () => {
    ;(prisma.surgerySymptomOverride.upsert as jest.Mock).mockResolvedValueOnce({
      surgeryId: 'surgery-1',
      baseSymptomId: 'base-1',
      ageGroup: 'U5',
      highlightedText: 'urgent notice',
    })

    const res = await POST(
      createRequest({
        surgeryId: 'surgery-1',
        baseId: 'base-1',
        highlightedText: 'urgent notice',
      })
    )

    expect(res.status).toBe(200)
    expect(markSymptomPendingReview).toHaveBeenCalledWith('surgery-1', 'base-1', 'U5')
  })

  it('does not reset review for a visibility-only (isHidden) change', async () => {
    ;(prisma.surgerySymptomOverride.upsert as jest.Mock).mockResolvedValueOnce({
      surgeryId: 'surgery-1',
      baseSymptomId: 'base-1',
      ageGroup: null,
      isHidden: true,
    })

    const res = await POST(
      createRequest({
        surgeryId: 'surgery-1',
        baseId: 'base-1',
        isHidden: true,
      })
    )

    expect(res.status).toBe(200)
    expect(markSymptomPendingReview).not.toHaveBeenCalled()
  })
})
