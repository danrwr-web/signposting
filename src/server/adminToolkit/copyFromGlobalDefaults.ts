import { prisma } from '@/lib/prisma'
import type { Prisma, PrismaClient } from '@prisma/client'

// Note: keep this file usable from API routes and scripts (no `server-only` import).

const GLOBAL_DEFAULTS_KEY = 'global-default-buttons'

type DbClient = PrismaClient | Prisma.TransactionClient

export type CopyFromGlobalDefaultsResult =
  | { status: 'skipped'; reason: 'already-has-content'; categoriesCreated: 0; itemsCreated: 0; attachmentsCreated: 0 }
  | { status: 'seeded'; categoriesCreated: number; itemsCreated: number; attachmentsCreated: number }

async function resolveGlobalDefaultsSurgery(db: DbClient) {
  const surgery = await db.surgery.findFirst({
    where: { OR: [{ id: GLOBAL_DEFAULTS_KEY }, { slug: GLOBAL_DEFAULTS_KEY }, { name: GLOBAL_DEFAULTS_KEY }] },
    select: { id: true },
  })
  if (!surgery) {
    throw new Error(`Global defaults surgery not found (id/slug/name "${GLOBAL_DEFAULTS_KEY}").`)
  }
  return surgery
}

export async function copyAdminToolkitFromGlobalDefaultsToSurgery(opts: {
  targetSurgeryId: string
  actorUserId: string
  db?: DbClient
}): Promise<CopyFromGlobalDefaultsResult> {
  const db = opts.db ?? prisma
  const { targetSurgeryId, actorUserId } = opts

  const [source, target] = await Promise.all([
    resolveGlobalDefaultsSurgery(db),
    db.surgery.findUnique({ where: { id: targetSurgeryId }, select: { id: true } }),
  ])
  if (!target) {
    throw new Error('Target surgery not found.')
  }

  const [targetCats, targetItems] = await Promise.all([
    db.adminCategory.count({ where: { surgeryId: targetSurgeryId, deletedAt: null } }),
    db.adminItem.count({ where: { surgeryId: targetSurgeryId, deletedAt: null } }),
  ])
  if (targetCats > 0 || targetItems > 0) {
    return { status: 'skipped', reason: 'already-has-content', categoriesCreated: 0, itemsCreated: 0, attachmentsCreated: 0 }
  }

  const [sourceCats, sourceItems] = await Promise.all([
    db.adminCategory.findMany({
      where: { surgeryId: source.id, deletedAt: null },
      select: { id: true, name: true, orderIndex: true },
      orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
    }),
    db.adminItem.findMany({
      where: { surgeryId: source.id, deletedAt: null, type: 'PAGE' },
      select: {
        id: true,
        categoryId: true,
        title: true,
        contentHtml: true,
        warningLevel: true,
        lastReviewedAt: true,
        updatedAt: true,
        attachments: {
          where: { deletedAt: null },
          select: { label: true, url: true, orderIndex: true },
          orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    }),
  ])

  const seeded = await db.$transaction(async (tx) => {
    const categoryIdMap = new Map<string, string>()
    for (const c of sourceCats) {
      const created = await tx.adminCategory.create({
        data: { surgeryId: targetSurgeryId, name: c.name, orderIndex: c.orderIndex },
        select: { id: true },
      })
      categoryIdMap.set(c.id, created.id)
    }

    let itemsCreated = 0
    let attachmentsCreated = 0

    for (const it of sourceItems) {
      const createdItem = await tx.adminItem.create({
        data: {
          surgeryId: targetSurgeryId,
          categoryId: it.categoryId ? categoryIdMap.get(it.categoryId) ?? null : null,
          type: 'PAGE',
          title: it.title,
          contentHtml: it.contentHtml ?? '',
          warningLevel: it.warningLevel ?? null,
          lastReviewedAt: it.lastReviewedAt ?? null,
          ownerUserId: null,
        },
        select: { id: true },
      })
      itemsCreated++

      if (it.attachments.length > 0) {
        await tx.adminItemAttachment.createMany({
          data: it.attachments.map((a) => ({
            surgeryId: targetSurgeryId,
            adminItemId: createdItem.id,
            label: a.label,
            url: a.url,
            orderIndex: a.orderIndex,
          })),
        })
        attachmentsCreated += it.attachments.length
      }
    }

    // Ensure pinned panel exists but is blank (do NOT copy values).
    await tx.adminPinnedPanel.upsert({
      where: { surgeryId: targetSurgeryId },
      update: { taskBuddyText: '', postRouteText: '' },
      create: { surgeryId: targetSurgeryId, taskBuddyText: '', postRouteText: '' },
    })

    // Ensure rota is blank (do NOT copy weeks).
    await tx.adminOnTakeWeek.deleteMany({ where: { surgeryId: targetSurgeryId } })

    await tx.adminHistory.create({
      data: {
        surgeryId: targetSurgeryId,
        action: 'TOOLKIT_AUTO_SEEDED_FROM_GLOBAL_DEFAULTS',
        actorUserId,
        diffJson: {
          sourceSurgeryId: source.id,
          categoriesCreated: sourceCats.length,
          itemsCreated,
          attachmentsCreated,
        },
      },
    })

    return { categoriesCreated: sourceCats.length, itemsCreated, attachmentsCreated }
  })

  return { status: 'seeded', ...seeded }
}

