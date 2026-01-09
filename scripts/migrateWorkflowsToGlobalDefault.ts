/**
 * One-off migration: move workflow templates from Ide Lane Surgery to Global Default.
 *
 * What it does
 * - Finds the target "Global Default" surgery (defaults to id OR slug `global-default-buttons`)
 * - Finds the source "Ide Lane Surgery" (defaults to name `Ide Lane Surgery`)
 * - Moves *custom* workflow templates owned by the source surgery (sourceTemplateId == null)
 *   to the Global Default surgery by updating `WorkflowTemplate.surgeryId`.
 *
 * What it does NOT do
 * - Does not create duplicates (no new templates are created)
 * - Does not modify nodes/options/links content (template IDs remain unchanged, so graph data stays intact)
 * - Does not move overrides (templates with sourceTemplateId != null) — these stay with the source surgery
 * - Does not touch workflow instances / answers (these are per-surgery runtime data)
 *
 * Safety
 * - DRY_RUN mode prints what would change without writing
 * - Fails fast if either surgery cannot be resolved
 * - Fails fast on potential name collisions (unless ALLOW_NAME_COLLISION=1)
 * - Wraps writes in a single transaction
 *
 * How to run
 * 1) DRY RUN (recommended):
 *    DRY_RUN=1 DATABASE_URL="..." npx tsx scripts/migrateWorkflowsToGlobalDefault.ts
 *
 * 2) Real run:
 *    DRY_RUN=0 DATABASE_URL="..." npx tsx scripts/migrateWorkflowsToGlobalDefault.ts
 *
 * Optional env vars
 * - TARGET_GLOBAL_KEY: defaults to `global-default-buttons` (matched against surgery.id first, then surgery.slug)
 * - SOURCE_SURGERY_ID / SOURCE_SURGERY_SLUG / SOURCE_SURGERY_NAME: defaults to SOURCE_SURGERY_NAME=`Ide Lane Surgery`
 * - ALLOW_NAME_COLLISION=1 to bypass name collision protection
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'y', 'on'].includes(value.toLowerCase())
}

async function resolveSurgeryOrThrow(opts: {
  id?: string
  slug?: string
  name?: string
  label: string
}) {
  const { id, slug, name, label } = opts

  if (id) {
    const byId = await prisma.surgery.findUnique({ where: { id } })
    if (byId) return byId
  }

  if (slug) {
    // slug is optional-but-unique in schema; use findFirst for robustness
    const bySlug = await prisma.surgery.findFirst({ where: { slug } })
    if (bySlug) return bySlug
  }

  if (name) {
    const byName = await prisma.surgery.findFirst({ where: { name } })
    if (byName) return byName
  }

  throw new Error(
    `Cannot resolve ${label} surgery. Tried id=${id ?? '—'}, slug=${slug ?? '—'}, name=${name ?? '—'}.`,
  )
}

function normaliseName(name: string): string {
  return name.trim().toLowerCase()
}

async function main() {
  const DRY_RUN = isTruthyEnv(process.env.DRY_RUN ?? '1')
  const ALLOW_NAME_COLLISION = isTruthyEnv(process.env.ALLOW_NAME_COLLISION)

  const targetKey = process.env.TARGET_GLOBAL_KEY ?? 'global-default-buttons'
  const sourceSurgeryId = process.env.SOURCE_SURGERY_ID
  const sourceSurgerySlug = process.env.SOURCE_SURGERY_SLUG
  const sourceSurgeryName = process.env.SOURCE_SURGERY_NAME ?? 'Ide Lane Surgery'

  const target = await resolveSurgeryOrThrow({
    id: targetKey,
    slug: targetKey,
    label: 'target (Global Default)',
  })

  const source = await resolveSurgeryOrThrow({
    id: sourceSurgeryId,
    slug: sourceSurgerySlug,
    name: sourceSurgeryName,
    label: 'source (Ide Lane)',
  })

  if (target.id === source.id) {
    throw new Error(
      `Source and target surgeries are the same (${target.id}). Refusing to continue.`,
    )
  }

  const sourceTemplates = await prisma.workflowTemplate.findMany({
    where: { surgeryId: source.id },
    select: {
      id: true,
      name: true,
      sourceTemplateId: true,
      approvalStatus: true,
      isActive: true,
      workflowType: true,
    },
    orderBy: { name: 'asc' },
  })

  const candidates = sourceTemplates.filter((t) => t.sourceTemplateId === null)
  const skippedOverrides = sourceTemplates.filter((t) => t.sourceTemplateId !== null)

  const targetTemplates = await prisma.workflowTemplate.findMany({
    where: { surgeryId: target.id, sourceTemplateId: null },
    select: { id: true, name: true },
  })

  const targetNames = new Map(targetTemplates.map((t) => [normaliseName(t.name), t]))
  const collisions = candidates.filter((t) => targetNames.has(normaliseName(t.name)))

  console.log('--- Workflow migration: Ide Lane -> Global Default ---')
  console.log(`DRY_RUN: ${DRY_RUN ? 'true' : 'false'}`)
  console.log(
    `Target surgery: ${target.name} (id=${target.id}, slug=${target.slug ?? '—'})`,
  )
  console.log(
    `Source surgery: ${source.name} (id=${source.id}, slug=${source.slug ?? '—'})`,
  )
  console.log(`Found ${sourceTemplates.length} workflow templates on source`)
  console.log(
    `- Candidates to move (custom, sourceTemplateId == null): ${candidates.length}`,
  )
  console.log(`- Skipped overrides (sourceTemplateId != null): ${skippedOverrides.length}`)

  if (candidates.length === 0) {
    console.log('Nothing to move. Exiting.')
    return
  }

  if (collisions.length > 0 && !ALLOW_NAME_COLLISION) {
    const lines = collisions
      .map((t) => `- ${t.name} (id=${t.id}) collides with target template "${targetNames.get(normaliseName(t.name))?.name}"`)
      .join('\n')
    throw new Error(
      `Name collision(s) detected between source candidates and existing Global Default templates.\n` +
        `Refusing to continue to avoid duplicates.\n` +
        `Set ALLOW_NAME_COLLISION=1 to bypass.\n\n${lines}`,
    )
  }

  console.log('\nTemplates to move:')
  for (const t of candidates) {
    console.log(
      `- ${t.name} (id=${t.id}) status=${t.approvalStatus} active=${t.isActive} type=${t.workflowType}`,
    )
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN complete — no changes written.')
    return
  }

  const candidateIds = candidates.map((t) => t.id)

  const movedCount = await prisma.$transaction(async (tx) => {
    const result = await tx.workflowTemplate.updateMany({
      where: {
        surgeryId: source.id,
        id: { in: candidateIds },
        sourceTemplateId: null,
      },
      data: {
        surgeryId: target.id,
      },
    })

    if (result.count !== candidateIds.length) {
      throw new Error(
        `Expected to move ${candidateIds.length} templates but moved ${result.count}. Aborting.`,
      )
    }

    return result.count
  })

  console.log(`\n✅ Migration complete. Moved ${movedCount} templates.`)
}

main()
  .catch((error) => {
    console.error('\n❌ Migration failed:')
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

