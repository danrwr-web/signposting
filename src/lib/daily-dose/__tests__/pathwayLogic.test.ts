import {
  computeUnitStatus,
  computeThemeRAG,
  computeSecurePercentage,
  recommendNextUnit,
  type UnitProgressData,
} from '../pathwayLogic'

// ----------------------------------------------------------------
// Helper to build UnitProgressData quickly
// ----------------------------------------------------------------
function makeUnit(
  overrides: Partial<UnitProgressData> & { unitId: string }
): UnitProgressData {
  return {
    level: 'CORE',
    ordering: 0,
    status: 'NOT_STARTED',
    sessionsCompleted: 0,
    correctCount: 0,
    totalQuestions: 0,
    ...overrides,
  }
}

// ================================================================
// computeUnitStatus
// ================================================================
describe('computeUnitStatus', () => {
  it('returns NOT_STARTED when 0 sessions completed', () => {
    expect(computeUnitStatus({ sessionsCompleted: 0, correctCount: 0, totalQuestions: 0 })).toBe(
      'NOT_STARTED'
    )
  })

  it('returns IN_PROGRESS when only 1 session even with 100% accuracy', () => {
    expect(computeUnitStatus({ sessionsCompleted: 1, correctCount: 5, totalQuestions: 5 })).toBe(
      'IN_PROGRESS'
    )
  })

  it('returns IN_PROGRESS when ≥2 sessions but <80% accuracy', () => {
    expect(computeUnitStatus({ sessionsCompleted: 3, correctCount: 3, totalQuestions: 5 })).toBe(
      'IN_PROGRESS'
    )
  })

  it('returns SECURE when ≥2 sessions and ≥80% accuracy', () => {
    expect(computeUnitStatus({ sessionsCompleted: 2, correctCount: 8, totalQuestions: 10 })).toBe(
      'SECURE'
    )
  })

  it('returns SECURE at exactly 80% accuracy and exactly 2 sessions', () => {
    expect(computeUnitStatus({ sessionsCompleted: 2, correctCount: 4, totalQuestions: 5 })).toBe(
      'SECURE'
    )
  })

  it('returns IN_PROGRESS when 0 totalQuestions but >0 sessions', () => {
    expect(computeUnitStatus({ sessionsCompleted: 2, correctCount: 0, totalQuestions: 0 })).toBe(
      'IN_PROGRESS'
    )
  })
})

// ================================================================
// computeThemeRAG
// ================================================================
describe('computeThemeRAG', () => {
  it('returns not_started for empty units array', () => {
    expect(computeThemeRAG([])).toBe('not_started')
  })

  it('returns not_started when all units are NOT_STARTED', () => {
    const units = [
      makeUnit({ unitId: 'a', status: 'NOT_STARTED' }),
      makeUnit({ unitId: 'b', status: 'NOT_STARTED' }),
    ]
    expect(computeThemeRAG(units)).toBe('not_started')
  })

  it('returns red when <40% of units are Secure', () => {
    const units = [
      makeUnit({ unitId: 'a', status: 'SECURE' }),
      makeUnit({ unitId: 'b', status: 'IN_PROGRESS' }),
      makeUnit({ unitId: 'c', status: 'NOT_STARTED' }),
      makeUnit({ unitId: 'd', status: 'NOT_STARTED' }),
      makeUnit({ unitId: 'e', status: 'NOT_STARTED' }),
    ]
    expect(computeThemeRAG(units)).toBe('red') // 1/5 = 20%
  })

  it('returns amber when 40-79% of units are Secure', () => {
    const units = [
      makeUnit({ unitId: 'a', status: 'SECURE' }),
      makeUnit({ unitId: 'b', status: 'SECURE' }),
      makeUnit({ unitId: 'c', status: 'IN_PROGRESS' }),
      makeUnit({ unitId: 'd', status: 'NOT_STARTED' }),
      makeUnit({ unitId: 'e', status: 'NOT_STARTED' }),
    ]
    expect(computeThemeRAG(units)).toBe('amber') // 2/5 = 40%
  })

  it('returns green when ≥80% of units are Secure', () => {
    const units = [
      makeUnit({ unitId: 'a', status: 'SECURE' }),
      makeUnit({ unitId: 'b', status: 'SECURE' }),
      makeUnit({ unitId: 'c', status: 'SECURE' }),
      makeUnit({ unitId: 'd', status: 'SECURE' }),
      makeUnit({ unitId: 'e', status: 'IN_PROGRESS' }),
    ]
    expect(computeThemeRAG(units)).toBe('green') // 4/5 = 80%
  })

  it('returns green when all units are Secure', () => {
    const units = [
      makeUnit({ unitId: 'a', status: 'SECURE' }),
      makeUnit({ unitId: 'b', status: 'SECURE' }),
    ]
    expect(computeThemeRAG(units)).toBe('green')
  })
})

// ================================================================
// computeSecurePercentage
// ================================================================
describe('computeSecurePercentage', () => {
  it('returns 0 for empty array', () => {
    expect(computeSecurePercentage([])).toBe(0)
  })

  it('returns 100 when all units Secure', () => {
    const units = [
      makeUnit({ unitId: 'a', status: 'SECURE' }),
      makeUnit({ unitId: 'b', status: 'SECURE' }),
    ]
    expect(computeSecurePercentage(units)).toBe(100)
  })

  it('returns 0 when no units Secure', () => {
    const units = [
      makeUnit({ unitId: 'a', status: 'IN_PROGRESS' }),
      makeUnit({ unitId: 'b', status: 'NOT_STARTED' }),
    ]
    expect(computeSecurePercentage(units)).toBe(0)
  })

  it('rounds correctly', () => {
    const units = [
      makeUnit({ unitId: 'a', status: 'SECURE' }),
      makeUnit({ unitId: 'b', status: 'IN_PROGRESS' }),
      makeUnit({ unitId: 'c', status: 'NOT_STARTED' }),
    ]
    expect(computeSecurePercentage(units)).toBe(33) // 1/3 = 33.33... → 33
  })
})

// ================================================================
// recommendNextUnit
// ================================================================
describe('recommendNextUnit', () => {
  it('returns null for empty array', () => {
    expect(recommendNextUnit([])).toBeNull()
  })

  it('Rule 1: returns first incomplete Intro unit in sequence', () => {
    const units: UnitProgressData[] = [
      makeUnit({ unitId: 'intro1', level: 'INTRO', ordering: 1, status: 'SECURE' }),
      makeUnit({ unitId: 'intro2', level: 'INTRO', ordering: 2, status: 'IN_PROGRESS' }),
      makeUnit({ unitId: 'core1', level: 'CORE', ordering: 1, status: 'NOT_STARTED' }),
    ]
    expect(recommendNextUnit(units)).toBe('intro2')
  })

  it('Rule 2: returns weakest core unit when all intro units are Secure', () => {
    const units: UnitProgressData[] = [
      makeUnit({ unitId: 'intro1', level: 'INTRO', ordering: 1, status: 'SECURE' }),
      makeUnit({
        unitId: 'core1',
        level: 'CORE',
        ordering: 1,
        status: 'IN_PROGRESS',
        correctCount: 7,
        totalQuestions: 10,
        sessionsCompleted: 1,
      }),
      makeUnit({
        unitId: 'core2',
        level: 'CORE',
        ordering: 2,
        status: 'IN_PROGRESS',
        correctCount: 3,
        totalQuestions: 10,
        sessionsCompleted: 1,
      }),
    ]
    expect(recommendNextUnit(units)).toBe('core2') // 30% is weaker than 70%
  })

  it('Rule 2: prefers NOT_STARTED core (0 accuracy) over IN_PROGRESS', () => {
    const units: UnitProgressData[] = [
      makeUnit({ unitId: 'intro1', level: 'INTRO', ordering: 1, status: 'SECURE' }),
      makeUnit({
        unitId: 'core1',
        level: 'CORE',
        ordering: 1,
        status: 'IN_PROGRESS',
        correctCount: 5,
        totalQuestions: 10,
        sessionsCompleted: 1,
      }),
      makeUnit({
        unitId: 'core2',
        level: 'CORE',
        ordering: 2,
        status: 'NOT_STARTED',
      }),
    ]
    expect(recommendNextUnit(units)).toBe('core2') // 0% accuracy
  })

  it('Rule 3: returns first incomplete stretch unit when all intro and core are Secure', () => {
    const units: UnitProgressData[] = [
      makeUnit({ unitId: 'intro1', level: 'INTRO', ordering: 1, status: 'SECURE' }),
      makeUnit({ unitId: 'core1', level: 'CORE', ordering: 1, status: 'SECURE' }),
      makeUnit({ unitId: 'stretch1', level: 'STRETCH', ordering: 1, status: 'NOT_STARTED' }),
      makeUnit({ unitId: 'stretch2', level: 'STRETCH', ordering: 2, status: 'NOT_STARTED' }),
    ]
    expect(recommendNextUnit(units)).toBe('stretch1')
  })

  it('Rule 4: returns lowest accuracy unit when all are Secure (maintenance)', () => {
    const units: UnitProgressData[] = [
      makeUnit({
        unitId: 'intro1',
        level: 'INTRO',
        ordering: 1,
        status: 'SECURE',
        correctCount: 9,
        totalQuestions: 10,
        sessionsCompleted: 3,
      }),
      makeUnit({
        unitId: 'core1',
        level: 'CORE',
        ordering: 1,
        status: 'SECURE',
        correctCount: 8,
        totalQuestions: 10,
        sessionsCompleted: 2,
      }),
      makeUnit({
        unitId: 'stretch1',
        level: 'STRETCH',
        ordering: 1,
        status: 'SECURE',
        correctCount: 16,
        totalQuestions: 20,
        sessionsCompleted: 2,
      }),
    ]
    expect(recommendNextUnit(units)).toBe('core1') // 80% < 80% = stretch1 at 80% too, but core1 is 80%... let me recalculate: core1=80%, stretch1=80%, intro1=90%. Lowest is core1 & stretch1 tied at 80%. Sort is stable so core1 appears first.
  })
})
