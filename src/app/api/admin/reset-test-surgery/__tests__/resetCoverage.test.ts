import { readFileSync } from 'fs'
import path from 'path'

/**
 * The reset clears a test surgery's review state and audit trail. Anything that
 * depends on those has to go with them, or the reset leaves rows in a state no
 * normal flow produces — a smart visual whose approval was wiped, for instance,
 * silently reverting to unapproved with no record of where it came from.
 *
 * Nothing fails when a model is forgotten here: the reset succeeds and the
 * stale rows simply persist. This asserts the dependants are cleared, so adding
 * a model that hangs off review state is a decision rather than an oversight.
 */
const route = readFileSync(
  path.resolve(__dirname, '../route.ts'),
  'utf8'
)

describe('reset-test-surgery', () => {
  it.each([
    ['symptomReviewStatus', 'clinical review state'],
    ['symptomHistory', 'symptom audit trail'],
    ['symptomSmartVisual', 'AI visuals, whose approval lives in review state'],
  ])('clears %s (%s)', model => {
    expect(route).toContain(`prisma.${model}.deleteMany`)
  })

  it('scopes the smart-visual deletion to the surgery being reset', () => {
    // A reset must never reach another practice's data.
    expect(route).toMatch(
      /prisma\.symptomSmartVisual\.deleteMany\(\{\s*where:\s*\{\s*surgeryId\s*\}/
    )
  })
})
