'use server'

import { z } from 'zod'
import { requireSuperuser } from '@/lib/rbac'
import { seedAdminToolkitGlobalDefaults } from '@/server/adminToolkit/seedGlobalDefaults'

type ActionError =
  | { code: 'UNAUTHENTICATED' | 'FORBIDDEN'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'UNKNOWN'; message: string }

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError }

const seedInput = z.object({
  force: z.boolean().optional().default(false),
})

export async function seedAdminToolkitGlobalDefaultsAction(input: unknown): Promise<
  ActionResult<{
    skipped: boolean
    reason?: string
    categoriesCreated: number
    itemsCreated: number
  }>
> {
  const parsed = seedInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input.' } }
  }

  try {
    await requireSuperuser()
  } catch {
    return { ok: false, error: { code: 'FORBIDDEN', message: 'Superuser access required.' } }
  }

  try {
    const res = await seedAdminToolkitGlobalDefaults({ force: parsed.data.force })
    return {
      ok: true,
      data: {
        skipped: res.skipped,
        reason: res.reason,
        categoriesCreated: res.categoriesCreated,
        itemsCreated: res.itemsCreated,
      },
    }
  } catch (err) {
    return {
      ok: false,
      error: { code: 'UNKNOWN', message: err instanceof Error ? err.message : 'Failed to seed global defaults.' },
    }
  }
}

