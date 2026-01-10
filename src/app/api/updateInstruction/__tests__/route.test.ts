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
})

