import { execSync } from 'child_process'
import path from 'path'
import { aiInstructionCustomisationWhere } from '@/lib/aiCustomisationHistory'
import { SMART_VISUAL_HISTORY_ENTRY } from '@/lib/symptomSmartVisualShared'

const repoRoot = path.resolve(__dirname, '../../..')

describe('aiInstructionCustomisationWhere', () => {
  it('requires an attributed model and excludes reverts and smart visuals', () => {
    const where = aiInstructionCustomisationWhere(['s1', 's2'])

    expect(where.symptomId).toEqual({ in: ['s1', 's2'] })
    expect(where.modelUsed).toEqual({ not: null })
    expect(where.NOT).toEqual([
      { modelUsed: 'REVERT' },
      { entryType: SMART_VISUAL_HISTORY_ENTRY },
    ])
  })

  it('is the only place the predicate is written', () => {
    // Three consumers each hand-wrote this, in two different spellings. When
    // smart visuals began writing attributed history rows, one was updated and
    // the other two kept completing the checklist step — silently, because a
    // wrong answer here looks exactly like a right one.
    // Matches on the REVERT exclusion, which is what the three copies shared.
    // Deliberately not `modelUsed: { not: null }` alone: aiRerunPlan asks a
    // different question — whether a symptom's *current content* came from AI
    // output — and screens rows by comparing content, so it is not a copy of
    // this predicate and must not be dragged into it.
    const out = execSync(
      "grep -rln \"NOT: { modelUsed: 'REVERT' }\\|notIn: \\['REVERT'\\]\" src " +
        "--include='*.ts' --include='*.tsx' || true",
      { cwd: repoRoot, encoding: 'utf8' }
    )

    const offenders = out
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .filter(f => !f.includes('__tests__') && !f.includes('.test.'))
      .filter(f => f !== 'src/lib/aiCustomisationHistory.ts')

    expect(offenders).toEqual([])
  })
})
