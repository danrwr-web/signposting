/**
 * One-off remediation: move tenant-flavoured prose out of polluted BaseSymptom
 * rows and into a SurgerySymptomOverride for Ide Lane (the originating
 * surgery), then null the prose fields on the base.
 *
 * Run:
 *   npx ts-node scripts/fix-promoted-base-pollution.ts            # dry-run
 *   npx ts-node scripts/fix-promoted-base-pollution.ts --apply    # write
 *
 * Optional env to point at a different originating surgery:
 *   SOURCE_SURGERY_ID, SOURCE_SURGERY_SLUG, SOURCE_SURGERY_NAME (default
 *   SOURCE_SURGERY_NAME=`Ide Lane Surgery`).
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PROSE_FIELDS = [
  'briefInstruction',
  'instructions',
  'instructionsHtml',
  'instructionsJson',
  'highlightedText',
] as const

type ProseField = typeof PROSE_FIELDS[number]

function isNonEmpty(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

async function resolveSourceSurgeryId(): Promise<string> {
  const id = process.env.SOURCE_SURGERY_ID
  if (id) {
    const found = await prisma.surgery.findUnique({ where: { id } })
    if (!found) throw new Error(`SOURCE_SURGERY_ID=${id} not found`)
    return found.id
  }
  const slug = process.env.SOURCE_SURGERY_SLUG
  if (slug) {
    const found = await prisma.surgery.findUnique({ where: { slug } })
    if (!found) throw new Error(`SOURCE_SURGERY_SLUG=${slug} not found`)
    return found.id
  }
  const name = process.env.SOURCE_SURGERY_NAME ?? 'Ide Lane Surgery'
  const found = await prisma.surgery.findUnique({ where: { name } })
  if (!found) throw new Error(`SOURCE_SURGERY_NAME=${name} not found`)
  return found.id
}

async function main() {
  const apply = process.argv.includes('--apply')
  const sourceSurgeryId = await resolveSourceSurgeryId()

  console.log('--- BaseSymptom pollution remediation ---')
  console.log(`mode:                ${apply ? 'APPLY (writing changes)' : 'DRY-RUN (no writes)'}`)
  console.log(`originating surgery: ${sourceSurgeryId}`)
  console.log()

  const polluted = await prisma.baseSymptom.findMany({
    where: {
      isDeleted: false,
      OR: PROSE_FIELDS.map((f) => ({ [f]: { not: null } })),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      briefInstruction: true,
      instructions: true,
      instructionsHtml: true,
      instructionsJson: true,
      highlightedText: true,
    },
  })

  console.log(`found ${polluted.length} BaseSymptom row(s) with non-null prose fields`)
  console.log()

  let migrated = 0
  let skippedNoProse = 0

  for (const base of polluted) {
    const proseToMove: Partial<Record<ProseField, string | null>> = {}
    for (const f of PROSE_FIELDS) {
      const v = (base as any)[f] as string | null
      if (isNonEmpty(v)) proseToMove[f] = v
    }
    if (Object.keys(proseToMove).length === 0) {
      skippedNoProse++
      continue
    }

    console.log(`[base ${base.id}] ${base.name} (slug=${base.slug})`)
    for (const [f, v] of Object.entries(proseToMove)) {
      const preview = (v ?? '').replace(/\s+/g, ' ').slice(0, 120)
      console.log(`    move ${f}: "${preview}${(v ?? '').length > 120 ? '…' : ''}"`)
    }

    if (!apply) {
      migrated++
      continue
    }

    const existingOverride = await prisma.surgerySymptomOverride.findUnique({
      where: { surgeryId_baseSymptomId: { surgeryId: sourceSurgeryId, baseSymptomId: base.id } },
      select: PROSE_FIELDS.reduce((acc, f) => ({ ...acc, [f]: true }), {} as Record<ProseField, true>),
    })

    // Only fill blank fields on an existing override; never clobber an
    // intentional surgery-side value.
    const overrideUpdate: Partial<Record<ProseField, string | null>> = {}
    for (const f of PROSE_FIELDS) {
      const incoming = proseToMove[f]
      if (incoming === undefined) continue
      const existing = existingOverride ? (existingOverride as any)[f] as string | null : null
      if (!isNonEmpty(existing)) overrideUpdate[f] = incoming
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(overrideUpdate).length > 0) {
        await tx.surgerySymptomOverride.upsert({
          where: { surgeryId_baseSymptomId: { surgeryId: sourceSurgeryId, baseSymptomId: base.id } },
          update: overrideUpdate,
          create: {
            surgeryId: sourceSurgeryId,
            baseSymptomId: base.id,
            ...overrideUpdate,
          },
        })
        console.log(`    upserted override fields: ${Object.keys(overrideUpdate).join(', ')}`)
      } else {
        console.log(`    override already populated; nulling base only`)
      }

      await tx.baseSymptom.update({
        where: { id: base.id },
        data: {
          briefInstruction: null,
          instructions: null,
          instructionsHtml: null,
          instructionsJson: null,
          highlightedText: null,
        },
      })
      console.log(`    nulled prose fields on base ${base.id}`)
    })

    migrated++
  }

  console.log()
  console.log(`summary: ${migrated} base row(s) ${apply ? 'migrated' : 'would be migrated'}, ${skippedNoProse} skipped (no non-empty prose)`)
  if (!apply) console.log('re-run with --apply to write changes.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
