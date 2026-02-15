/**
 * Recovery script for Practice Handbook items affected by the edit page data loss bug.
 *
 * This script:
 * 1. Reports items recently updated that have null categoryId (indicating potential data loss)
 * 2. Shows AdminHistory audit trail to help identify what was lost
 * 3. Can optionally restore categoryId from history if the bug is detected
 *
 * Usage:
 *   npx tsx scripts/recover-handbook-items.ts --report
 *   npx tsx scripts/recover-handbook-items.ts --restore --surgery-id=<surgeryId>
 *   npx tsx scripts/recover-handbook-items.ts --restore --item-id=<itemId>
 *
 * @see https://github.com/your-org/signposting/issues/XXX (data loss bug fix)
 */

import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface AffectedItem {
  id: string
  surgeryId: string
  surgeryName: string
  title: string
  type: string
  categoryId: string | null
  updatedAt: Date
  updatedByUserId: string | null
  lastCategoryIdFromHistory: string | null
  historyEntries: Array<{
    action: string
    summary: string | null
    diffJson: unknown
    createdAt: Date
  }>
}

/**
 * Find items that appear to be affected by the data loss bug:
 * - categoryId is null
 * - Recently updated (within the last 30 days)
 * - Has history entries that show categoryId was previously set
 */
async function findAffectedItems(options?: { surgeryId?: string; sinceDays?: number }): Promise<AffectedItem[]> {
  const sinceDays = options?.sinceDays ?? 30
  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - sinceDays)

  const whereClause: import('@prisma/client').Prisma.AdminItemWhereInput = {
    deletedAt: null,
    categoryId: null,
    updatedAt: { gte: sinceDate },
    type: { in: ['PAGE', 'LIST'] },
  }

  if (options?.surgeryId) {
    whereClause.surgeryId = options.surgeryId
  }

  const items = await prisma.adminItem.findMany({
    where: whereClause,
    include: {
      surgery: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const affected: AffectedItem[] = []

  for (const item of items) {
    // Get history entries to understand what happened
    const history = await prisma.adminHistory.findMany({
      where: { adminItemId: item.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Look for the last known categoryId from history
    let lastCategoryIdFromHistory: string | null = null
    for (const entry of history) {
      if (entry.diffJson && typeof entry.diffJson === 'object') {
        const diff = entry.diffJson as Record<string, unknown>
        // Check 'before' state in ITEM_UPDATE actions
        if (diff.before && typeof diff.before === 'object') {
          const before = diff.before as Record<string, unknown>
          if (before.categoryId && typeof before.categoryId === 'string') {
            lastCategoryIdFromHistory = before.categoryId
            break
          }
        }
        // Check 'after' state in older entries
        if (diff.after && typeof diff.after === 'object') {
          const after = diff.after as Record<string, unknown>
          if (after.categoryId && typeof after.categoryId === 'string') {
            lastCategoryIdFromHistory = after.categoryId
            break
          }
        }
        // Check direct categoryId in ITEM_CREATE
        if (diff.categoryId && typeof diff.categoryId === 'string') {
          lastCategoryIdFromHistory = diff.categoryId
          break
        }
      }
    }

    // Only include items that had a categoryId before (indicating data loss)
    if (lastCategoryIdFromHistory) {
      affected.push({
        id: item.id,
        surgeryId: item.surgeryId,
        surgeryName: item.surgery.name,
        title: item.title,
        type: item.type,
        categoryId: item.categoryId,
        updatedAt: item.updatedAt,
        updatedByUserId: item.updatedByUserId,
        lastCategoryIdFromHistory,
        historyEntries: history.map((h) => ({
          action: h.action,
          summary: h.summary,
          diffJson: h.diffJson,
          createdAt: h.createdAt,
        })),
      })
    }
  }

  return affected
}

/**
 * Find items with empty content fields that were recently updated
 */
async function findItemsWithEmptyContent(options?: { surgeryId?: string; sinceDays?: number }): Promise<
  Array<{
    id: string
    surgeryId: string
    surgeryName: string
    title: string
    categoryId: string | null
    updatedAt: Date
    contentHtml: string | null
    contentJson: unknown
  }>
> {
  const sinceDays = options?.sinceDays ?? 30
  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - sinceDays)

  const whereClause: import('@prisma/client').Prisma.AdminItemWhereInput = {
    deletedAt: null,
    updatedAt: { gte: sinceDate },
    type: 'PAGE',
    OR: [{ contentHtml: { equals: null } }, { contentHtml: '' }, { contentJson: { equals: Prisma.DbNull } }],
  }

  if (options?.surgeryId) {
    whereClause.surgeryId = options.surgeryId
  }

  const items = await prisma.adminItem.findMany({
    where: whereClause,
    include: {
      surgery: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return items.map((item) => ({
    id: item.id,
    surgeryId: item.surgeryId,
    surgeryName: item.surgery.name,
    title: item.title,
    categoryId: item.categoryId,
    updatedAt: item.updatedAt,
    contentHtml: item.contentHtml,
    contentJson: item.contentJson,
  }))
}

/**
 * Restore categoryId for a specific item from history
 */
async function restoreCategoryId(itemId: string, categoryId: string, dryRun = true): Promise<boolean> {
  // Verify the category exists
  const item = await prisma.adminItem.findFirst({
    where: { id: itemId, deletedAt: null },
    select: { id: true, surgeryId: true, title: true, categoryId: true },
  })

  if (!item) {
    console.error(`Item ${itemId} not found`)
    return false
  }

  if (item.categoryId === categoryId) {
    console.log(`Item ${itemId} already has categoryId=${categoryId}, skipping`)
    return true
  }

  // Verify the target category exists
  const category = await prisma.adminCategory.findFirst({
    where: { id: categoryId, surgeryId: item.surgeryId, deletedAt: null },
    select: { id: true, name: true },
  })

  if (!category) {
    console.error(`Category ${categoryId} not found or deleted in surgery ${item.surgeryId}`)
    return false
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would restore item "${item.title}" (${item.id}) to category "${category.name}" (${categoryId})`)
    return true
  }

  // Perform the restoration
  await prisma.$transaction(async (tx) => {
    await tx.adminItem.update({
      where: { id: itemId },
      data: { categoryId },
    })

    await tx.adminHistory.create({
      data: {
        surgeryId: item.surgeryId,
        adminItemId: itemId,
        action: 'ITEM_CATEGORY_RESTORED',
        actorUserId: 'SYSTEM_RECOVERY',
        entityType: 'ADMIN_ITEM',
        summary: `Restored categoryId via recovery script (was null due to bug)`,
        diffJson: {
          before: { categoryId: item.categoryId },
          after: { categoryId },
          restoredFrom: 'history',
        },
      },
    })
  })

  console.log(`Restored item "${item.title}" (${item.id}) to category "${category.name}" (${categoryId})`)
  return true
}

/**
 * Generate a report of affected items
 */
async function generateReport(options?: { surgeryId?: string; sinceDays?: number }): Promise<void> {
  console.log('\n=== Practice Handbook Data Recovery Report ===\n')
  console.log(`Looking for items updated in the last ${options?.sinceDays ?? 30} days...\n`)

  // Find items with null categoryId
  const affectedItems = await findAffectedItems(options)

  if (affectedItems.length === 0) {
    console.log('✓ No items found with null categoryId that previously had a category.\n')
  } else {
    console.log(`⚠ Found ${affectedItems.length} items with categoryId set to null:\n`)

    for (const item of affectedItems) {
      console.log(`  Item: "${item.title}"`)
      console.log(`    ID: ${item.id}`)
      console.log(`    Surgery: ${item.surgeryName} (${item.surgeryId})`)
      console.log(`    Type: ${item.type}`)
      console.log(`    Updated: ${item.updatedAt.toISOString()}`)
      console.log(`    Current categoryId: ${item.categoryId ?? '(null)'}`)
      console.log(`    Previous categoryId (from history): ${item.lastCategoryIdFromHistory}`)
      console.log(`    Recent history:`)
      for (const entry of item.historyEntries.slice(0, 3)) {
        console.log(`      - ${entry.action}: ${entry.summary ?? '(no summary)'} @ ${entry.createdAt.toISOString()}`)
      }
      console.log()
    }

    console.log(`\nTo restore these items, run:`)
    console.log(`  npx tsx scripts/recover-handbook-items.ts --restore\n`)
  }

  // Find items with empty content
  const emptyContentItems = await findItemsWithEmptyContent(options)

  if (emptyContentItems.length === 0) {
    console.log('✓ No PAGE items found with empty content fields.\n')
  } else {
    console.log(`⚠ Found ${emptyContentItems.length} PAGE items with empty content:\n`)

    for (const item of emptyContentItems) {
      console.log(`  Item: "${item.title}"`)
      console.log(`    ID: ${item.id}`)
      console.log(`    Surgery: ${item.surgeryName}`)
      console.log(`    Updated: ${item.updatedAt.toISOString()}`)
      console.log(`    contentHtml: ${item.contentHtml ? `(${item.contentHtml.length} chars)` : '(null/empty)'}`)
      console.log(`    contentJson: ${item.contentJson ? 'present' : '(null)'}`)
      console.log()
    }

    console.log(
      `\nNote: Empty content may be intentional. Review these items manually.\n` +
        `For content restoration, use Neon PITR branch to recover from a point before the bug occurred.\n`,
    )
  }
}

/**
 * Restore categoryIds for all affected items
 */
async function restoreAffectedItems(options?: { surgeryId?: string; sinceDays?: number; dryRun?: boolean }): Promise<void> {
  const dryRun = options?.dryRun ?? true

  if (dryRun) {
    console.log('\n=== DRY RUN MODE - No changes will be made ===\n')
  } else {
    console.log('\n=== RESTORATION MODE - Changes will be made ===\n')
  }

  const affectedItems = await findAffectedItems(options)

  if (affectedItems.length === 0) {
    console.log('No items need restoration.\n')
    return
  }

  console.log(`Found ${affectedItems.length} items to restore.\n`)

  let restored = 0
  let failed = 0

  for (const item of affectedItems) {
    if (item.lastCategoryIdFromHistory) {
      const success = await restoreCategoryId(item.id, item.lastCategoryIdFromHistory, dryRun)
      if (success) {
        restored++
      } else {
        failed++
      }
    }
  }

  console.log(`\nResults: ${restored} restored, ${failed} failed`)

  if (dryRun && restored > 0) {
    console.log(`\nTo apply these changes, run with --no-dry-run flag.`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const isReport = args.includes('--report')
  const isRestore = args.includes('--restore')
  const dryRun = !args.includes('--no-dry-run')

  const surgeryIdArg = args.find((a) => a.startsWith('--surgery-id='))
  const surgeryId = surgeryIdArg ? surgeryIdArg.split('=')[1] : undefined

  const sinceDaysArg = args.find((a) => a.startsWith('--since-days='))
  const sinceDays = sinceDaysArg ? parseInt(sinceDaysArg.split('=')[1], 10) : 30

  if (!isReport && !isRestore) {
    console.log('Usage:')
    console.log('  npx tsx scripts/recover-handbook-items.ts --report [--surgery-id=<id>] [--since-days=30]')
    console.log('  npx tsx scripts/recover-handbook-items.ts --restore [--surgery-id=<id>] [--since-days=30] [--no-dry-run]')
    console.log()
    console.log('Options:')
    console.log('  --report          Generate a report of affected items')
    console.log('  --restore         Attempt to restore categoryIds from history')
    console.log('  --surgery-id=<id> Limit to a specific surgery')
    console.log('  --since-days=N    Look at items updated in the last N days (default: 30)')
    console.log('  --no-dry-run      Actually perform the restoration (default is dry run)')
    process.exit(1)
  }

  try {
    if (isReport) {
      await generateReport({ surgeryId, sinceDays })
    } else if (isRestore) {
      await restoreAffectedItems({ surgeryId, sinceDays, dryRun })
    }
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
