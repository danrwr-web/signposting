/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server'
import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAdmin } from '@/lib/rbac'

// A permissive stand-in: every model resolves to the same set of no-op methods.
// These tests are about the guard in front of the reset, not about which models
// it clears (resetCoverage.test.ts asserts that), and listing thirty models by
// hand would make the suite fail whenever the reset gains one — noise that says
// nothing about whether the guard still holds.
jest.mock('@/lib/prisma', () => {
  const model = () => ({
    findMany: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
  })
  const models = new Map<string, ReturnType<typeof model>>()
  return {
    prisma: new Proxy(
      { $transaction: jest.fn() } as Record<string, unknown>,
      {
        get(target, prop: string) {
          if (prop in target) return target[prop]
          if (!models.has(prop)) models.set(prop, model())
          return models.get(prop)
        },
      }
    ),
  }
})

jest.mock('@/lib/rbac', () => ({ requireSurgeryAdmin: jest.fn() }))

jest.mock('@/server/effectiveSymptoms', () => ({ getEffectiveSymptoms: jest.fn() }))

const findUnique = prisma.surgery.findUnique as jest.Mock
const transaction = prisma.$transaction as jest.Mock
const mockedAdmin = requireSurgeryAdmin as jest.MockedFunction<typeof requireSurgeryAdmin>

const makeReq = (body: unknown): NextRequest =>
  ({ json: async () => body }) as unknown as NextRequest

describe('POST /api/admin/reset-test-surgery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedAdmin.mockResolvedValue(undefined as never)
    transaction.mockResolvedValue([])
    ;(prisma.userSurgery.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.surgerySymptomOverride.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.surgeryCustomSymptom.findMany as jest.Mock).mockResolvedValue([])
  })

  it('refuses a LIVE practice that happens to be named "Test Surgery"', async () => {
    // The whole guard used to be the name, and a name is free text an admin can
    // set. Reaching the reset means thirteen deleteMany calls against a real
    // practice's content.
    findUnique.mockResolvedValue({ id: 's1', name: 'Test Surgery', surgeryType: 'LIVE' })

    const res = await POST(makeReq({ surgeryId: 's1', state: 'fresh' }))

    expect(res.status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
    // The message has to say what to change, or it reads as a bug.
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining('LIVE'),
    })
  })

  it('refuses a practice of the right type but the wrong name', async () => {
    findUnique.mockResolvedValue({ id: 's1', name: "St Mary's", surgeryType: 'TEST' })

    const res = await POST(makeReq({ surgeryId: 's1', state: 'fresh' }))

    expect(res.status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('proceeds when both the name and the type agree', async () => {
    findUnique.mockResolvedValue({ id: 's1', name: 'Test Surgery', surgeryType: 'TEST' })

    const res = await POST(makeReq({ surgeryId: 's1', state: 'fresh' }))

    expect(res.status).toBe(200)
    expect(transaction).toHaveBeenCalled()
  })

  it('checks admin rights before reading the surgery at all', async () => {
    mockedAdmin.mockRejectedValue(new Error('Surgery admin access required'))

    const res = await POST(makeReq({ surgeryId: 's1', state: 'fresh' }))

    expect(res.status).toBe(401)
    expect(findUnique).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects an unknown reset state before touching anything', async () => {
    const res = await POST(makeReq({ surgeryId: 's1', state: 'wipe-everything' }))

    expect(res.status).toBe(400)
    expect(mockedAdmin).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })
})
