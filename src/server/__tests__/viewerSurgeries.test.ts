import { surgeriesForViewer } from '../viewerSurgeries'
import { prisma } from '@/lib/prisma'
import type { SessionUser } from '@/lib/rbac'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    surgery: {
      findMany: jest.fn(),
    },
  },
}))

const findMany = prisma.surgery.findMany as jest.Mock

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-1',
    email: 'nurse@example.com',
    globalRole: 'USER',
    isTestUser: false,
    symptomsUsed: 0,
    memberships: [{ surgeryId: 'surgery-a', role: 'STANDARD' }],
    ...overrides,
  }
}

describe('surgeriesForViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    findMany.mockResolvedValue([])
  })

  it('returns nothing for a signed-out visitor, without querying', async () => {
    // The regression this module exists for: the list is serialised into every
    // page's HTML, so an anonymous visitor must not receive practice names or
    // internal surgery ids.
    const result = await surgeriesForViewer(null)

    expect(result).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })

  it('restricts a normal user to their own memberships', async () => {
    await surgeriesForViewer(
      user({
        memberships: [
          { surgeryId: 'surgery-a', role: 'STANDARD' },
          { surgeryId: 'surgery-b', role: 'ADMIN' },
        ],
      })
    )

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['surgery-a', 'surgery-b'] } },
      })
    )
  })

  it('excludes a default surgery the user has no membership for', async () => {
    // defaultSurgeryId can outlive the membership it came from, and neither
    // PermissionChecker nor SurgeryProvider will act on one without a
    // membership — so including it would disclose a surgery for no benefit.
    await surgeriesForViewer(user({ defaultSurgeryId: 'surgery-z' }))

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['surgery-a'] } },
      })
    )
  })

  it('returns nothing for a user whose only default is not a membership', async () => {
    const result = await surgeriesForViewer(
      user({ memberships: [], defaultSurgeryId: 'surgery-z' })
    )

    expect(result).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })

  it('gives a superuser every surgery', async () => {
    await surgeriesForViewer(user({ globalRole: 'SUPERUSER', memberships: [] }))

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } })
    )
    expect(findMany.mock.calls[0][0]).not.toHaveProperty('where')
  })

  it('never selects columns beyond those the switcher needs', async () => {
    await surgeriesForViewer(user())

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, slug: true, name: true, surgeryType: true },
      })
    )
  })
})
