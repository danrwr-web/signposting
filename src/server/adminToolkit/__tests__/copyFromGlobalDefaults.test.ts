import { copyAdminToolkitFromGlobalDefaultsToSurgery } from '@/server/adminToolkit/copyFromGlobalDefaults'

describe('copyAdminToolkitFromGlobalDefaultsToSurgery', () => {
  it('throws a clear error if global defaults surgery is missing', async () => {
    const db: any = {
      surgery: {
        findFirst: async () => null,
        findUnique: async () => ({ id: 'target' }),
      },
    }

    await expect(
      copyAdminToolkitFromGlobalDefaultsToSurgery({ targetSurgeryId: 'target', actorUserId: 'actor', db }),
    ).rejects.toThrow(/Global defaults surgery not found/)
  })

  it('skips seeding when the target already has content', async () => {
    const db: any = {
      surgery: {
        findFirst: async () => ({ id: 'global-defaults' }),
        findUnique: async () => ({ id: 'target' }),
      },
      adminCategory: { count: async () => 1 },
      adminItem: { count: async () => 0 },
    }

    const res = await copyAdminToolkitFromGlobalDefaultsToSurgery({ targetSurgeryId: 'target', actorUserId: 'actor', db })
    expect(res).toEqual({
      status: 'skipped',
      reason: 'already-has-content',
      categoriesCreated: 0,
      itemsCreated: 0,
      attachmentsCreated: 0,
    })
  })
})

