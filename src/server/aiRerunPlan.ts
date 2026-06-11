import 'server-only'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'

/**
 * Plan for a superuser-driven "smart re-run" of AI customisation: re-run only
 * the symptoms whose current content was produced by an AI run and has not
 * been touched by a human since, so local edits are never overwritten.
 *
 * SymptomHistory has no surgeryId — override history rows for a base symptom
 * mix every surgery's edits — and manual saves record modelUsed as
 * 'unknown-model', so metadata alone cannot identify "this surgery's human
 * edits". Classification therefore matches CONTENT: a symptom is safe to
 * re-run only when its current override/custom content is exactly the output
 * an AI run recorded in history. AI output embeds surgery-specific
 * terminology, so cross-surgery content collisions are not a practical
 * concern. Notice-only (highlightedText) edits are not detected; the
 * clinical-review queue remains the safety net for those.
 */

export type AiRerunClassification = 'never-customised' | 'ai-customised' | 'human-edited'

export interface AiRerunPlanItem {
  id: string
  name: string
  ageGroup: string
  source: 'base' | 'override' | 'custom'
  classification: AiRerunClassification
  safeToRerun: boolean
  lastEditedBy?: string | null
  lastEditedAt?: string | null
}

export interface AiRerunPlan {
  items: AiRerunPlanItem[]
  safeCount: number
  skippedCount: number
}

// modelUsed values that do NOT represent AI-generated content:
// manual editor saves record 'unknown-model'; reverts record 'REVERT'.
const NON_AI_MODEL_MARKERS = new Set(['unknown-model', 'REVERT'])

const sameContent = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '') === (b ?? '')

export async function computeAiRerunPlan(surgeryId: string): Promise<AiRerunPlan> {
  const effective = await getEffectiveSymptoms(surgeryId, false)

  const baseIds = effective
    .filter((s) => s.source !== 'custom')
    .map((s) => s.baseSymptomId || s.id)
  const customIds = effective.filter((s) => s.source === 'custom').map((s) => s.id)

  const [overrides, history] = await Promise.all([
    prisma.surgerySymptomOverride.findMany({
      where: { surgeryId, baseSymptomId: { in: baseIds } },
      select: {
        baseSymptomId: true,
        briefInstruction: true,
        instructionsHtml: true,
        lastEditedBy: true,
        lastEditedAt: true,
      },
    }),
    prisma.symptomHistory.findMany({
      where: { symptomId: { in: [...baseIds, ...customIds] }, modelUsed: { not: null } },
      select: {
        symptomId: true,
        modelUsed: true,
        newBriefInstruction: true,
        newInstructionsHtml: true,
      },
    }),
  ])

  const aiOutputsBySymptom = new Map<
    string,
    Array<{ brief: string | null; html: string | null }>
  >()
  for (const row of history) {
    if (!row.modelUsed || NON_AI_MODEL_MARKERS.has(row.modelUsed)) continue
    const outputs = aiOutputsBySymptom.get(row.symptomId) || []
    outputs.push({ brief: row.newBriefInstruction, html: row.newInstructionsHtml })
    aiOutputsBySymptom.set(row.symptomId, outputs)
  }

  const matchesAiOutput = (
    symptomId: string,
    brief: string | null | undefined,
    html: string | null | undefined
  ) =>
    (aiOutputsBySymptom.get(symptomId) || []).some(
      (output) => sameContent(output.brief, brief) && sameContent(output.html, html)
    )

  const overrideByBaseId = new Map(overrides.map((o) => [o.baseSymptomId, o]))

  const items: AiRerunPlanItem[] = effective.map((s) => {
    if (s.source === 'custom') {
      // Custom symptoms are human-authored: only safe once an AI run has
      // produced their current content. Never-AI-touched customs are skipped.
      const isAiContent = matchesAiOutput(s.id, s.briefInstruction, s.instructionsHtml)
      return {
        id: s.id,
        name: s.name,
        ageGroup: s.ageGroup,
        source: 'custom' as const,
        classification: isAiContent ? ('ai-customised' as const) : ('human-edited' as const),
        safeToRerun: isAiContent,
      }
    }

    const id = s.baseSymptomId || s.id
    const override = overrideByBaseId.get(id)

    // No override content at all (no row, or a row that only changes e.g. the
    // name): nothing human-written would be overwritten.
    if (!override || (override.briefInstruction == null && override.instructionsHtml == null)) {
      return {
        id,
        name: s.name,
        ageGroup: s.ageGroup,
        source: s.source,
        classification: 'never-customised' as const,
        safeToRerun: true,
      }
    }

    const isAiContent = matchesAiOutput(id, override.briefInstruction, override.instructionsHtml)
    return {
      id,
      name: s.name,
      ageGroup: s.ageGroup,
      source: s.source,
      classification: isAiContent ? ('ai-customised' as const) : ('human-edited' as const),
      safeToRerun: isAiContent,
      lastEditedBy: override.lastEditedBy ?? null,
      lastEditedAt: override.lastEditedAt ? override.lastEditedAt.toISOString() : null,
    }
  })

  return {
    items,
    safeCount: items.filter((i) => i.safeToRerun).length,
    skippedCount: items.filter((i) => !i.safeToRerun).length,
  }
}
