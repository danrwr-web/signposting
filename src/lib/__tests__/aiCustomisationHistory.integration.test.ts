/**
 * @jest-environment node
 */
/**
 * Runs against a real Postgres when INTEGRATION_DATABASE_URL is set; skipped
 * otherwise.
 *
 * These assertions need a database because the bug they guard is SQL semantics,
 * not TypeScript. `NOT: { entryType: 'SMART_VISUAL' }` reads as "everything
 * except visuals" and typechecks, but NULL compares as unknown, so it excluded
 * every instruction edit too — the predicate returned nothing at all. No unit
 * test over a mocked client could have caught that; only the database can.
 */
import { PrismaClient } from '@prisma/client'
import { aiInstructionCustomisationWhere } from '@/lib/aiCustomisationHistory'
import { SMART_VISUAL_HISTORY_ENTRY } from '@/lib/symptomSmartVisualShared'

const url = process.env.INTEGRATION_DATABASE_URL
const describeIf = url ? describe : describe.skip

describeIf('aiInstructionCustomisationWhere against Postgres', () => {
  let client: PrismaClient
  const RUN = `aichist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const SYMPTOM = `${RUN}-sym`
  const ids = {
    edit: `${RUN}-edit`,
    visual: `${RUN}-visual`,
    other: `${RUN}-other`,
    revert: `${RUN}-revert`,
  }

  beforeAll(async () => {
    client = new PrismaClient({ datasources: { db: { url } } })
    await client.symptomHistory.createMany({
      data: [
        // What a genuine AI wording edit writes: no entryType at all.
        { id: ids.edit, symptomId: SYMPTOM, source: 'override', newText: 'edit', modelUsed: 'gpt-4o-mini' },
        { id: ids.visual, symptomId: SYMPTOM, source: 'override', newText: 'visual', modelUsed: 'gpt-4o-mini', entryType: SMART_VISUAL_HISTORY_ENTRY },
        { id: ids.other, symptomId: SYMPTOM, source: 'override', newText: 'other', modelUsed: 'gpt-4o-mini', entryType: 'SOMETHING_ELSE' },
        { id: ids.revert, symptomId: SYMPTOM, source: 'override', newText: 'undo', modelUsed: 'REVERT' },
      ],
    })
  })

  afterAll(async () => {
    if (!client) return
    await client.symptomHistory.deleteMany({ where: { symptomId: SYMPTOM } })
    await client.$disconnect()
  })

  it('matches a genuine AI instruction edit, and only that', async () => {
    const rows = await client.symptomHistory.findMany({
      where: aiInstructionCustomisationWhere([SYMPTOM]),
      select: { id: true },
    })

    expect(rows.map(r => r.id)).toEqual([ids.edit])
  })

  it('does not silently match nothing', async () => {
    // The failure mode that shipped: a predicate excluding everything looks
    // identical to "this practice has not run AI customisation".
    const count = await client.symptomHistory.count({
      where: aiInstructionCustomisationWhere([SYMPTOM]),
    })

    expect(count).toBeGreaterThan(0)
  })
})
