/**
 * One-time backfill: populate sourceAdminItemIds on existing DailyDoseCards
 * by heuristically matching card titles against AdminItem titles in the
 * same surgery.
 *
 * Usage: npx tsx scripts/backfill-source-admin-items.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const STOP_WORDS = new Set([
  'and', 'or', 'the', 'for', 'in', 'of', 'a', 'an', 'to', 'with',
  'from', 'by', 'at', 'on', 'is', 'are', 'was', 'were', 'be',
  'non', 'not', 'no', 'how', 'what', 'when', 'who', 'why', 'this',
  'that', 'their', 'they', 'them', 'you', 'your', 'our', 'has',
  'have', 'had', 'can', 'will', 'should', 'may', 'might', 'must',
])

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}

function scoreMatch(promptTokens: Set<string>, itemTitle: string): number {
  const titleTokens = tokenise(itemTitle)
  if (titleTokens.length === 0) return 0
  let matched = 0
  for (const token of titleTokens) {
    if (promptTokens.has(token)) matched++
  }
  const coverage = matched / titleTokens.length
  if (coverage < 0.5 || matched < 1) return 0
  return coverage * matched
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log(`Backfilling sourceAdminItemIds${dryRun ? ' (DRY RUN)' : ''}...`)

  const cards = await prisma.dailyDoseCard.findMany({
    where: {
      isActive: true,
      sourceAdminItemIds: { equals: null },
    },
    select: { id: true, title: true, surgeryId: true },
  })

  console.log(`Found ${cards.length} cards without sourceAdminItemIds`)

  const surgeryIds = [...new Set(cards.filter((c) => c.surgeryId).map((c) => c.surgeryId!))]
  const adminItemsBySurgery = new Map<string, Array<{ id: string; title: string }>>()

  for (const surgeryId of surgeryIds) {
    const items = await prisma.adminItem.findMany({
      where: { surgeryId, deletedAt: null },
      select: { id: true, title: true },
    })
    adminItemsBySurgery.set(surgeryId, items)
  }

  let updated = 0
  let skipped = 0

  for (const card of cards) {
    if (!card.surgeryId) {
      skipped++
      continue
    }

    const items = adminItemsBySurgery.get(card.surgeryId) ?? []
    if (items.length === 0) {
      skipped++
      continue
    }

    const promptTokens = new Set(tokenise(card.title))
    if (promptTokens.size === 0) {
      skipped++
      continue
    }

    const matched = items
      .map((item) => ({ id: item.id, score: scoreMatch(promptTokens, item.title) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((entry) => entry.id)

    if (matched.length === 0) {
      skipped++
      continue
    }

    if (dryRun) {
      console.log(`  [DRY] ${card.title} -> ${matched.length} admin items`)
    } else {
      await prisma.dailyDoseCard.update({
        where: { id: card.id },
        data: { sourceAdminItemIds: matched },
      })
    }
    updated++
  }

  console.log(`Done. Updated: ${updated}, Skipped: ${skipped}`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
