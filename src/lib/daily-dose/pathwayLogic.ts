import {
  PATHWAY_SECURE_ACCURACY_THRESHOLD,
  PATHWAY_SECURE_MIN_SESSIONS,
  PATHWAY_RAG_RED_THRESHOLD,
  PATHWAY_RAG_AMBER_THRESHOLD,
  type PathwayUnitLevel,
  type PathwayUnitStatus,
} from './constants'

export type UnitProgressData = {
  unitId: string
  level: PathwayUnitLevel
  ordering: number
  status: PathwayUnitStatus
  sessionsCompleted: number
  correctCount: number
  totalQuestions: number
}

export type ThemeRAG = 'red' | 'amber' | 'green' | 'not_started'

/** Compute whether a unit qualifies as "Secure" based on sessions and accuracy */
export function computeUnitStatus(progress: {
  sessionsCompleted: number
  correctCount: number
  totalQuestions: number
}): PathwayUnitStatus {
  if (progress.sessionsCompleted === 0) return 'NOT_STARTED'
  const accuracy =
    progress.totalQuestions > 0 ? progress.correctCount / progress.totalQuestions : 0
  if (
    accuracy >= PATHWAY_SECURE_ACCURACY_THRESHOLD &&
    progress.sessionsCompleted >= PATHWAY_SECURE_MIN_SESSIONS
  ) {
    return 'SECURE'
  }
  return 'IN_PROGRESS'
}

/** Compute theme RAG colour from its units' mastery */
export function computeThemeRAG(units: UnitProgressData[]): ThemeRAG {
  if (units.length === 0) return 'not_started'
  const allNotStarted = units.every((u) => u.status === 'NOT_STARTED')
  if (allNotStarted) return 'not_started'

  const secureCount = units.filter((u) => u.status === 'SECURE').length
  const ratio = secureCount / units.length

  if (ratio >= PATHWAY_RAG_AMBER_THRESHOLD) return 'green'
  if (ratio >= PATHWAY_RAG_RED_THRESHOLD) return 'amber'
  return 'red'
}

/** Compute percentage of units that are Secure */
export function computeSecurePercentage(units: UnitProgressData[]): number {
  if (units.length === 0) return 0
  const secureCount = units.filter((u) => u.status === 'SECURE').length
  return Math.round((secureCount / units.length) * 100)
}

/**
 * Recommend the next unit to study using 4 deterministic rules:
 * 1. First incomplete Intro unit in sequence
 * 2. Weakest Core unit (lowest accuracy) if all Intro Secure
 * 3. First incomplete Stretch unit if all Core Secure
 * 4. Maintenance: lowest accuracy unit if everything is Secure
 */
export function recommendNextUnit(units: UnitProgressData[]): string | null {
  if (units.length === 0) return null

  const byLevel = (level: PathwayUnitLevel) =>
    units.filter((u) => u.level === level).sort((a, b) => a.ordering - b.ordering)

  const introUnits = byLevel('INTRO')
  const coreUnits = byLevel('CORE')
  const stretchUnits = byLevel('STRETCH')

  // Rule 1: Incomplete intro unit exists -> next intro in sequence
  const incompleteIntro = introUnits.find((u) => u.status !== 'SECURE')
  if (incompleteIntro) return incompleteIntro.unitId

  // Rule 2: All intro secure -> weakest core unit (lowest accuracy)
  const incompleteCoreUnits = coreUnits.filter((u) => u.status !== 'SECURE')
  if (incompleteCoreUnits.length > 0) {
    const weakest = [...incompleteCoreUnits].sort((a, b) => {
      const accA = a.totalQuestions > 0 ? a.correctCount / a.totalQuestions : 0
      const accB = b.totalQuestions > 0 ? b.correctCount / b.totalQuestions : 0
      return accA - accB
    })
    return weakest[0].unitId
  }

  // Rule 3: All core secure -> first incomplete stretch unit
  const incompleteStretch = stretchUnits.find((u) => u.status !== 'SECURE')
  if (incompleteStretch) return incompleteStretch.unitId

  // Rule 4: All units secure -> maintenance (revisit lowest accuracy unit)
  const allUnits = [...units].sort((a, b) => {
    const accA = a.totalQuestions > 0 ? a.correctCount / a.totalQuestions : 0
    const accB = b.totalQuestions > 0 ? b.correctCount / b.totalQuestions : 0
    return accA - accB
  })
  return allUnits[0]?.unitId ?? null
}
