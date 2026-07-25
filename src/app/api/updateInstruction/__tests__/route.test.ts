import { NextRequest } from 'next/server'
import { PATCH } from '../route'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/rbac', () => ({
  getSessionUser: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    baseSymptom: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    surgerySymptomOverride: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    symptomHistory: {
      create: jest.fn(),
    },
    surgeryCustomSymptom: {
      findUnique: jest.fn(),
      update: jest.fn(),
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

const mockedGetSessionUser = getSessionUser as jest.MockedFunction<typeof getSessionUser>

const createRequest = (body?: Record<string, unknown>): NextRequest =>
  ({
    json: async () => body,
  } as unknown as NextRequest)

describe('PATCH /api/updateInstruction', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns 403 for standard users', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({
      id: 'u1',
      email: 'user@example.com',
      globalRole: 'USER',
      memberships: [{ surgeryId: 'surgery-a', role: 'STANDARD' }],
    } as any)

    const res = await PATCH(
      createRequest({
        symptomId: 'base-1',
        source: 'base',
        surgeryId: 'surgery-a',
        newInstructionsHtml: '<p>Updated</p>',
      })
    )

    expect(res.status).toBe(403)
  })

  it('allows an admin to update Surgery A via override', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({
      id: 'u1',
      email: 'admin@example.com',
      globalRole: 'USER',
      memberships: [{ surgeryId: 'surgery-a', role: 'ADMIN' }],
      name: 'Admin',
    } as any)

    ;(prisma.baseSymptom.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'base-1',
      briefInstruction: 'before',
      instructionsHtml: '<p>before</p>',
      instructionsJson: null,
    })

    ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValueOnce(null)

    ;(prisma.$transaction as jest.Mock).mockImplementationOnce(async (fn: any) => {
      return fn(prisma)
    })

    const res = await PATCH(
      createRequest({
        symptomId: 'base-1',
        source: 'base',
        surgeryId: 'surgery-a',
        newInstructionsHtml: '<p>after</p>',
      })
    )

    expect(res.status).toBe(200)
    expect(prisma.surgerySymptomOverride.upsert).toHaveBeenCalled()
    expect(prisma.symptomHistory.create).toHaveBeenCalled()
  })

  it('does not allow an admin of Surgery A to update Surgery B', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({
      id: 'u1',
      email: 'admin@example.com',
      globalRole: 'USER',
      memberships: [{ surgeryId: 'surgery-a', role: 'ADMIN' }],
    } as any)

    const res = await PATCH(
      createRequest({
        symptomId: 'base-1',
        source: 'base',
        surgeryId: 'surgery-b',
        newInstructionsHtml: '<p>after</p>',
      })
    )

    expect(res.status).toBe(403)
  })

  it('writes a superuser override update to the surgery override, not the base symptom', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({
      id: 'u1',
      email: 'super@example.com',
      globalRole: 'SUPERUSER',
      memberships: [],
      name: 'Super',
    } as any)

    ;(prisma.baseSymptom.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'base-1',
      briefInstruction: 'before',
      instructionsHtml: '<p>before</p>',
      instructionsJson: null,
    })

    ;(prisma.surgerySymptomOverride.findUnique as jest.Mock).mockResolvedValueOnce({
      briefInstruction: null,
      instructionsHtml: '<p>customised</p>',
      instructionsJson: null,
    })

    ;(prisma.$transaction as jest.Mock).mockImplementationOnce(async (fn: any) => {
      return fn(prisma)
    })

    const res = await PATCH(
      createRequest({
        symptomId: 'base-1',
        source: 'override',
        surgeryId: 'surgery-1',
        newInstructionsHtml: '<p>after</p>',
      })
    )

    expect(res.status).toBe(200)
    expect(prisma.surgerySymptomOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { surgeryId_baseSymptomId: { surgeryId: 'surgery-1', baseSymptomId: 'base-1' } },
      })
    )
    expect(prisma.baseSymptom.update).not.toHaveBeenCalled()
    expect(prisma.symptomHistory.create).toHaveBeenCalled()
  })

  it('rejects a superuser override update without a surgeryId', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({
      id: 'u1',
      email: 'super@example.com',
      globalRole: 'SUPERUSER',
      memberships: [],
    } as any)

    const res = await PATCH(
      createRequest({
        symptomId: 'base-1',
        source: 'override',
        newInstructionsHtml: '<p>after</p>',
      })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('surgeryId is required for override updates')
    expect(prisma.surgerySymptomOverride.upsert).not.toHaveBeenCalled()
    expect(prisma.baseSymptom.update).not.toHaveBeenCalled()
  })

  it('still lets a superuser update the base symptom globally with source base', async () => {
    mockedGetSessionUser.mockResolvedValueOnce({
      id: 'u1',
      email: 'super@example.com',
      globalRole: 'SUPERUSER',
      memberships: [],
      name: 'Super',
    } as any)

    ;(prisma.baseSymptom.findUnique as jest.Mock).mockResolvedValueOnce({
      briefInstruction: 'before',
      instructionsHtml: '<p>before</p>',
    })

    const res = await PATCH(
      createRequest({
        symptomId: 'base-1',
        source: 'base',
        newInstructionsHtml: '<p>after</p>',
      })
    )

    expect(res.status).toBe(200)
    expect(prisma.baseSymptom.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'base-1' } })
    )
    expect(prisma.surgerySymptomOverride.upsert).not.toHaveBeenCalled()
  })
})

