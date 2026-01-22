jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('REDIRECT')
  }),
}))

// Avoid pulling in NextAuth (and its ESM deps) in unit tests.
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    surgery: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
    userSurgery: { findMany: jest.fn() },
  },
}))

import * as rbac from './rbac'
import { canAccessAdminToolkitAdminDashboard } from './adminToolkitPermissions'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

describe('rbac: requireSurgeryMembership (Admin Toolkit landing)', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('standard member can resolve slug and pass membership guard', async () => {
    const surgeryId = 's1'
    ;(getServerSession as unknown as jest.Mock).mockResolvedValue({ user: { id: 'u1' } })
    ;(prisma.user.findUnique as unknown as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'u1@example.com',
      name: null,
      globalRole: 'USER',
      defaultSurgeryId: null,
      defaultSurgery: null,
      isTestUser: false,
      symptomUsageLimit: null,
      symptomsUsed: 0,
      memberships: [
        {
          surgeryId,
          role: 'STANDARD',
          adminToolkitWrite: false,
          surgery: { id: surgeryId, name: 'Surgery', slug: 'some-slug' },
        },
      ],
    } as any)

    jest.spyOn(prisma.surgery, 'findFirst').mockResolvedValue({ id: surgeryId } as any)

    const res = await rbac.requireSurgeryMembership('some-slug')
    expect(res.surgeryId).toBe(surgeryId)
    expect(res.user.id).toBe('u1')
    expect(res.surgeryRole).toBe('STANDARD')
  })

  test('non-member is redirected to /unauthorized', async () => {
    const surgeryId = 's1'
    ;(getServerSession as unknown as jest.Mock).mockResolvedValue({ user: { id: 'u2' } })
    ;(prisma.user.findUnique as unknown as jest.Mock).mockResolvedValue({
      id: 'u2',
      email: 'u2@example.com',
      name: null,
      globalRole: 'USER',
      defaultSurgeryId: null,
      defaultSurgery: null,
      isTestUser: false,
      symptomUsageLimit: null,
      symptomsUsed: 0,
      memberships: [],
    } as any)

    jest.spyOn(prisma.surgery, 'findFirst').mockResolvedValue({ id: surgeryId } as any)

    await expect(rbac.requireSurgeryMembership(surgeryId)).rejects.toThrow('REDIRECT')
  })

  test('standard user cannot access admin dashboard (helper)', () => {
    const surgeryId = 's1'
    const user = {
      id: 'u1',
      email: 'u1@example.com',
      globalRole: 'USER',
      isTestUser: false,
      symptomsUsed: 0,
      memberships: [{ surgeryId, role: 'STANDARD' }],
    } as any

    expect(canAccessAdminToolkitAdminDashboard(user, surgeryId)).toBe(false)
  })
})

