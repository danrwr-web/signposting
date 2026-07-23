import { NextRequest } from 'next/server'
import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import { requireSuperuser } from '@/lib/rbac'
import { copyAdminToolkitFromGlobalDefaultsToSurgery } from '@/server/adminToolkit/copyFromGlobalDefaults'

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

jest.mock('@/server/adminToolkit/copyFromGlobalDefaults', () => ({
  copyAdminToolkitFromGlobalDefaultsToSurgery: jest.fn(),
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}))

const mockedRequireSuperuser = requireSuperuser as jest.MockedFunction<typeof requireSuperuser>
const mockedCopyToolkit = copyAdminToolkitFromGlobalDefaultsToSurgery as jest.MockedFunction<
  typeof copyAdminToolkitFromGlobalDefaultsToSurgery
>

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
    mockedRequireSuperuser.mockResolvedValue({ id: 'super-1' } as never)
    mockedCopyToolkit.mockResolvedValue({
      status: 'seeded',
      categoriesCreated: 8,
      itemsCreated: 10,
      attachmentsCreated: 0,
    })

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

  it('seeds the Practice Handbook when the admin_toolkit feature is selected', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.feature.findMany as jest.Mock).mockResolvedValue([
      { id: 'feat-toolkit', key: 'admin_toolkit' },
      { id: 'feat-other', key: 'workflows' },
    ])

    const res = await POST(
      makeReq({ ...validBody, featureFlagIds: ['feat-toolkit', 'feat-other'] }),
      ctx
    )

    expect(res.status).toBe(201)
    expect(mockedCopyToolkit).toHaveBeenCalledWith({
      targetSurgeryId: 'sur-1',
      actorUserId: 'super-1',
      db: prisma,
    })
  })

  it('does not seed the Practice Handbook when admin_toolkit is not selected', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.feature.findMany as jest.Mock).mockResolvedValue([
      { id: 'feat-other', key: 'workflows' },
    ])

    const res = await POST(makeReq({ ...validBody, featureFlagIds: ['feat-other'] }), ctx)

    expect(res.status).toBe(201)
    expect(mockedCopyToolkit).not.toHaveBeenCalled()
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
