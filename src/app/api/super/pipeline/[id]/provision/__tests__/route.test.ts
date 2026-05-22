import { NextRequest } from 'next/server'
import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import { requireSuperuser } from '@/lib/rbac'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    salesPipeline: { findUnique: jest.fn(), update: jest.fn() },
    surgery: { findUnique: jest.fn(), create: jest.fn() },
    feature: { findMany: jest.fn() },
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    userSurgery: { create: jest.fn() },
    surgeryFeatureFlag: { createMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/rbac', () => ({
  requireSuperuser: jest.fn(),
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}))

const mockedRequireSuperuser = requireSuperuser as jest.MockedFunction<typeof requireSuperuser>

const makeReq = (body: unknown) =>
  ({ json: async () => body } as unknown as NextRequest)

const ctx = { params: Promise.resolve({ id: 'pipe-1' }) }

const validBody = {
  surgeryName: 'Mt Pleasant Health Centre',
  adminEmail: 'admin@mtpleasant.example',
  adminName: 'Dr Example',
  temporaryPassword: 'temppass123',
  featureFlagIds: [],
}

describe('POST /api/super/pipeline/[id]/provision', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireSuperuser.mockResolvedValue(undefined as never)

    ;(prisma.salesPipeline.findUnique as jest.Mock).mockResolvedValue({
      id: 'pipe-1',
      status: 'Contracted',
      linkedSurgeryId: null,
    })
    // Called for both the name check and the slug check — no clashes.
    ;(prisma.surgery.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.surgery.create as jest.Mock).mockResolvedValue({ id: 'sur-1' })
    ;(prisma.userSurgery.create as jest.Mock).mockResolvedValue({})
    ;(prisma.salesPipeline.update as jest.Mock).mockResolvedValue({})
    ;(prisma.user.create as jest.Mock).mockResolvedValue({ id: 'user-new' })
    ;(prisma.user.update as jest.Mock).mockResolvedValue({})
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(prisma))
  })

  it('creates a fresh account when no user has the admin email', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await POST(makeReq(validBody), ctx)

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.reusedExistingAccount).toBe(false)
    expect(json.temporaryPasswordSet).toBe(true)
    expect(prisma.user.create).toHaveBeenCalledTimes(1)
    expect(prisma.userSurgery.create).toHaveBeenCalledWith({
      data: { userId: 'user-new', surgeryId: 'sur-1', role: 'ADMIN' },
    })
  })

  it('reuses an existing account instead of erroring', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-existing',
      email: validBody.adminEmail,
      password: 'existing-hash',
      defaultSurgeryId: 'some-other-surgery',
    })

    const res = await POST(makeReq(validBody), ctx)

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.reusedExistingAccount).toBe(true)
    expect(json.temporaryPasswordSet).toBe(false)
    expect(json.userId).toBe('user-existing')
    // The existing account must not be re-created or have its password touched.
    expect(prisma.user.create).not.toHaveBeenCalled()
    // It already has a password and a default surgery, so nothing to update.
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(prisma.userSurgery.create).toHaveBeenCalledWith({
      data: { userId: 'user-existing', surgeryId: 'sur-1', role: 'ADMIN' },
    })
  })

  it('sets the default surgery for a reused account that has none', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-existing',
      email: validBody.adminEmail,
      password: 'existing-hash',
      defaultSurgeryId: null,
    })

    const res = await POST(makeReq(validBody), ctx)

    expect(res.status).toBe(201)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-existing' },
      data: { defaultSurgeryId: 'sur-1' },
    })
  })

  it('sets the temporary password for a reused account that has none', async () => {
    // Legacy accounts can have password = null; auth rejects those users,
    // so provisioning must give them a usable credential.
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-existing',
      email: validBody.adminEmail,
      password: null,
      defaultSurgeryId: 'some-other-surgery',
    })

    const res = await POST(makeReq(validBody), ctx)

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.reusedExistingAccount).toBe(true)
    expect(json.temporaryPasswordSet).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-existing' },
      data: { password: 'hashed-password' },
    })
  })
})
