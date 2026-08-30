/**
 * Which symptom-page visits count as reception-desk usage.
 *
 * Some links into /symptom/[id] are internal review traffic — a clinician
 * checking wording before approving it, a superuser opening the symptom behind
 * a suggestion — and logging those as staff lookups inflates a practice's
 * engagement figures. The referrer arrives in either `ref` or `from` depending
 * on which link was used (`from` also drives the "Back to Clinical Review"
 * link in InstructionView), so both are checked here rather than at each call
 * site: the previous inline `ref !== 'clinical-review'` test silently missed
 * every `from=clinical-review` link.
 */

export const INTERNAL_ENGAGEMENT_REFS = ['clinical-review', 'suggestions'] as const

export type InternalEngagementRef = (typeof INTERNAL_ENGAGEMENT_REFS)[number]

/** First value of a Next.js search param, which may repeat. */
export function firstParam(value: string | string[] | undefined | null): string | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

/**
 * True when any of the given referrer values marks this visit as internal, and
 * so not a symptom view worth recording.
 */
export function isInternalEngagementRef(
  ...values: Array<string | string[] | undefined | null>
): boolean {
  return values.some(value => {
    const first = firstParam(value)
    return !!first && (INTERNAL_ENGAGEMENT_REFS as readonly string[]).includes(first)
  })
}
