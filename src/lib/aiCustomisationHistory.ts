import type { Prisma } from '@prisma/client'

/**
 * The one definition of "AI has customised this practice's instructions".
 *
 * Three places asked this question independently — the setup tracker, the setup
 * checklist page and /api/admin/metrics — each with its own hand-written
 * predicate, and each spelled slightly differently (`NOT: { modelUsed }` versus
 * `notIn: ['REVERT']`). When smart visuals started writing attributable history
 * rows, one copy was updated and the other two silently kept completing the
 * checklist step. A shared definition is the only way that stays fixed.
 *
 * What counts: a history row carrying the model that produced it, for one of
 * this surgery's symptoms.
 *
 * What does not:
 * - REVERT rows, which record an edit being undone rather than made.
 * - Smart-visual rows. They are genuine AI output and correctly attributed, but
 *   they change no instruction wording, and the checklist step they would
 *   satisfy asks the practice to "tailor symptom instructions to your
 *   appointment model".
 */
export function aiInstructionCustomisationWhere(
  symptomIds: string[]
): Prisma.SymptomHistoryWhereInput {
  return {
    symptomId: { in: symptomIds },
    modelUsed: { not: null },
    // `entryType: null`, NOT `NOT: { entryType: SMART_VISUAL }`.
    //
    // The negated form looked equivalent and is not: SQL compares NULL to
    // anything as unknown, so `NOT (entryType = 'SMART_VISUAL')` is false for
    // the NULL rows every instruction edit writes — excluding exactly the rows
    // this predicate exists to find. Measured against Postgres: it returned
    // nothing at all, which would have left the checklist step permanently
    // incomplete for every practice.
    //
    // Matching NULL positively is also the safer shape going forward. A future
    // non-wording AI feature that sets its own entryType is excluded by
    // default, rather than counted until someone remembers to add it here.
    entryType: null,
    NOT: { modelUsed: 'REVERT' },
  }
}
