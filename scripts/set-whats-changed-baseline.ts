/**
 * Script to set "What's changed" baseline dates for surgeries.
 * 
 * Usage:
 *   npx ts-node scripts/set-whats-changed-baseline.ts <surgerySlug> <module> <date>
 * 
 * Examples:
 *   npx ts-node scripts/set-whats-changed-baseline.ts surgery-1 practiceHandbook 2026-01-23
 *   npx ts-node scripts/set-whats-changed-baseline.ts ide-lane signposting 2026-01-29
 * 
 * Parameters:
 *   surgerySlug - The surgery slug or ID
 *   module      - 'signposting' or 'practiceHandbook'
 *   date        - ISO date string (YYYY-MM-DD)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type WhatsChangedModule = 'signposting' | 'practiceHandbook'

interface UiConfigWithBaselines {
  signposting?: {
    changesBaselineDate?: string
  }
  practiceHandbook?: {
    changesBaselineDate?: string
  }
  [key: string]: unknown
}

async function setBaseline(surgerySlug: string, module: WhatsChangedModule, dateStr: string) {
  // Find surgery by slug or ID
  let surgery = await prisma.surgery.findUnique({
    where: { slug: surgerySlug },
    select: { id: true, name: true, slug: true, uiConfig: true },
  })
  
  if (!surgery) {
    surgery = await prisma.surgery.findUnique({
      where: { id: surgerySlug },
      select: { id: true, name: true, slug: true, uiConfig: true },
    })
  }

  if (!surgery) {
    console.error(`Surgery not found: ${surgerySlug}`)
    process.exit(1)
  }

  // Validate date
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    console.error(`Invalid date: ${dateStr}`)
    process.exit(1)
  }

  // Build updated config
  const currentConfig = (surgery.uiConfig as UiConfigWithBaselines) ?? {}
  const isoDateStr = date.toISOString()

  const updatedConfig: UiConfigWithBaselines = {
    ...currentConfig,
    [module]: {
      ...currentConfig[module],
      changesBaselineDate: isoDateStr,
    },
  }

  // Update surgery
  await prisma.surgery.update({
    where: { id: surgery.id },
    data: { uiConfig: updatedConfig as import('@prisma/client').Prisma.InputJsonValue },
  })

  console.log(`✓ Set ${module} baseline for "${surgery.name}" (${surgery.slug}) to ${dateStr}`)
  console.log(`  Full ISO: ${isoDateStr}`)
}

async function main() {
  const [, , surgerySlug, module, dateStr] = process.argv

  if (!surgerySlug || !module || !dateStr) {
    console.log('Usage: npx ts-node scripts/set-whats-changed-baseline.ts <surgerySlug> <module> <date>')
    console.log('')
    console.log('Examples:')
    console.log('  npx ts-node scripts/set-whats-changed-baseline.ts surgery-1 practiceHandbook 2026-01-23')
    console.log('  npx ts-node scripts/set-whats-changed-baseline.ts ide-lane signposting 2026-01-29')
    process.exit(1)
  }

  if (module !== 'signposting' && module !== 'practiceHandbook') {
    console.error(`Invalid module: ${module}`)
    console.error('Must be "signposting" or "practiceHandbook"')
    process.exit(1)
  }

  await setBaseline(surgerySlug, module as WhatsChangedModule, dateStr)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
