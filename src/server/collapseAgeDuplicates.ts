import 'server-only'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms, EffectiveSymptom } from '@/server/effectiveSymptoms'

/**
 * Collapse duplicate age versions of symptoms for a surgery running in
 * "hide age bands" mode.
 *
 * With the age filter hidden, the up-to-three age versions of a symptom
 * (e.g. Cough U5 / O5 / Adult) would appear as identical cards. This module
 * computes which version of each duplicated name to KEEP and which to
 * DISABLE (via SurgerySymptomStatus, the same mechanism as the manual
 * disable action), so the front page shows one card per symptom.
 *
 * Keeper preference, per product decision:
 *   1. the locally-edited version (has a SurgerySymptomOverride);
 *      if several are edited, the most recently edited one
 *   2. otherwise the Adult version, then 5–17 (O5), then Under 5 (U5)
 *   3. deterministic id tiebreak for data anomalies
 *
 * Custom symptoms are never disabled; name collisions involving them are
 * reported so the superuser can resolve them manually.
 */

export interface CollapseCandidate {
  baseSymptomId: string
  ageGroup: 'U5' | 'O5' | 'Adult'
  source: 'base' | 'override'
}

export interface CollapseGroup {
  name: string
  kept: CollapseCandidate
  disabled: CollapseCandidate[]
  reason: 'override' | 'latest-override' | 'age-preference'
}

export interface CollapsePlan {
  groups: CollapseGroup[]
  counts: {
    duplicateGroups: number
    disabledCount: number
    keptCount: number
  }
  /** Names where a custom symptom shares a name with other versions — left untouched. */
  skippedCustomDuplicates: string[]
}

const AGE_PREFERENCE: Record<string, number> = { Adult: 0, O5: 1, U5: 2 }

type PlanRow = {
  baseSymptomId: string
  ageGroup: 'U5' | 'O5' | 'Adult'
  source: 'base' | 'override'
  overrideLastEditedAt: Date | null
  hasOverride: boolean
}

/**
 * Pure keeper selection over one duplicate group. Exported for tests.
 * Returns the rows partitioned into the kept row and the rest, with the
 * reason the keeper won.
 */
export function pickKeeper(rows: PlanRow[]): { kept: PlanRow; disabled: PlanRow[]; reason: CollapseGroup['reason'] } {
  const overridden = rows.filter(r => r.hasOverride)

  let kept: PlanRow
  let reason: CollapseGroup['reason']

  if (overridden.length === 1) {
    kept = overridden[0]
    reason = 'override'
  } else if (overridden.length > 1) {
    // Most recently edited wins; nulls sort last; then age preference; then id
    kept = [...overridden].sort((a, b) => {
      const aTime = a.overrideLastEditedAt ? a.overrideLastEditedAt.getTime() : -Infinity
      const bTime = b.overrideLastEditedAt ? b.overrideLastEditedAt.getTime() : -Infinity
      if (aTime !== bTime) return bTime - aTime
      const agePref = (AGE_PREFERENCE[a.ageGroup] ?? 3) - (AGE_PREFERENCE[b.ageGroup] ?? 3)
      if (agePref !== 0) return agePref
      return a.baseSymptomId.localeCompare(b.baseSymptomId)
    })[0]
    reason = 'latest-override'
  } else {
    kept = [...rows].sort((a, b) => {
      const agePref = (AGE_PREFERENCE[a.ageGroup] ?? 3) - (AGE_PREFERENCE[b.ageGroup] ?? 3)
      if (agePref !== 0) return agePref
      return a.baseSymptomId.localeCompare(b.baseSymptomId)
    })[0]
    reason = 'age-preference'
  }

  return {
    kept,
    disabled: rows.filter(r => r !== kept),
    reason,
  }
}

/**
 * Group the surgery's ENABLED effective symptoms by display name and compute
 * the collapse plan. Pure with respect to its inputs; exported for tests.
 */
export function buildCollapsePlan(
  symptoms: EffectiveSymptom[],
  overrideEditTimes: Map<string, Date | null>
): CollapsePlan {
  const byName = new Map<string, EffectiveSymptom[]>()
  for (const s of symptoms) {
    const key = s.name.trim().toLowerCase()
    const list = byName.get(key)
    if (list) list.push(s)
    else byName.set(key, [s])
  }

  const groups: CollapseGroup[] = []
  const skippedCustomDuplicates: string[] = []
  let disabledCount = 0

  for (const list of Array.from(byName.values())) {
    if (list.length < 2) continue

    const hasCustom = list.some(s => s.source === 'custom')
    if (hasCustom) {
      skippedCustomDuplicates.push(list[0].name)
      // Custom symptoms are never disabled, and disabling the base versions
      // around a custom one would be surprising — leave the whole group alone.
      continue
    }

    const rows: PlanRow[] = list.map(s => {
      const baseSymptomId = s.baseSymptomId || s.id
      return {
        baseSymptomId,
        ageGroup: s.ageGroup,
        source: s.source as 'base' | 'override',
        hasOverride: s.source === 'override',
        overrideLastEditedAt: overrideEditTimes.get(baseSymptomId) ?? null,
      }
    })

    const { kept, disabled, reason } = pickKeeper(rows)
    disabledCount += disabled.length
    groups.push({
      name: list[0].name,
      kept: { baseSymptomId: kept.baseSymptomId, ageGroup: kept.ageGroup, source: kept.source },
      disabled: disabled.map(d => ({ baseSymptomId: d.baseSymptomId, ageGroup: d.ageGroup, source: d.source })),
      reason,
    })
  }

  return {
    groups,
    counts: {
      duplicateGroups: groups.length,
      disabledCount,
      keptCount: groups.length,
    },
    skippedCustomDuplicates,
  }
}

/** Load the surgery's enabled symptoms and compute the collapse plan. */
export async function computeCollapsePlan(surgeryId: string): Promise<CollapsePlan> {
  const symptoms = await getEffectiveSymptoms(surgeryId)

  const overrides = await prisma.surgerySymptomOverride.findMany({
    where: { surgeryId },
    select: { baseSymptomId: true, lastEditedAt: true },
  })
  const overrideEditTimes = new Map<string, Date | null>(
    overrides.map(o => [o.baseSymptomId, o.lastEditedAt])
  )

  return buildCollapsePlan(symptoms, overrideEditTimes)
}

/**
 * Apply a collapse plan: disable every "disabled" entry via
 * SurgerySymptomStatus, mirroring the manual DISABLE action. There is no
 * compound unique on (surgeryId, baseSymptomId), so this find-then-update-
 * or-create runs inside a transaction rather than using upsert.
 */
export async function executeCollapsePlan(
  surgeryId: string,
  plan: CollapsePlan,
  editedBy: string
): Promise<void> {
  const toDisable = plan.groups.flatMap(g => g.disabled)
  if (toDisable.length === 0) return

  const now = new Date()

  await prisma.$transaction(async tx => {
    for (const entry of toDisable) {
      const existing = await tx.surgerySymptomStatus.findFirst({
        where: { surgeryId, baseSymptomId: entry.baseSymptomId },
        select: { id: true },
      })

      if (existing) {
        await tx.surgerySymptomStatus.update({
          where: { id: existing.id },
          data: {
            isEnabled: false,
            lastEditedAt: now,
            lastEditedBy: editedBy,
          },
        })
      } else {
        await tx.surgerySymptomStatus.create({
          data: {
            surgeryId,
            baseSymptomId: entry.baseSymptomId,
            isEnabled: false,
            isOverridden: false,
            lastEditedAt: now,
            lastEditedBy: editedBy,
          },
        })
      }
    }
  })
}
