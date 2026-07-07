/**
 * Shared helpers for symptom age groups ('U5' | 'O5' | 'Adult').
 *
 * Every symptom is age-band-specific: the same symptom name (e.g. "Cough")
 * can exist once per band. Use these helpers wherever a symptom is shown
 * outside the main directory (clinical review, previews, admin tables) so
 * the band is always visible and consistently styled.
 */

export type SymptomAgeGroup = 'U5' | 'O5' | 'Adult'

export const SYMPTOM_AGE_GROUPS: SymptomAgeGroup[] = ['U5', 'O5', 'Adult']

export function formatAgeGroupLabel(ageGroup: string | null | undefined): string {
  switch (ageGroup) {
    case 'U5':
      return 'Under 5'
    case 'O5':
      return '5–17'
    case 'Adult':
      return 'Adult'
    default:
      return ageGroup || 'All ages'
  }
}

/** Long-form label for prose contexts, e.g. "children under 5". */
export function formatAgeGroupDescription(ageGroup: string | null | undefined): string {
  switch (ageGroup) {
    case 'U5':
      return 'children under 5'
    case 'O5':
      return 'children and young people aged 5–17'
    case 'Adult':
      return 'adults'
    default:
      return 'all ages'
  }
}

/** Badge colour classes matching the directory's SymptomCard/AgeFilter palette. */
export function ageGroupBadgeClasses(ageGroup: string | null | undefined): string {
  switch (ageGroup) {
    case 'U5':
      return 'bg-blue-100 text-blue-800'
    case 'O5':
      return 'bg-green-100 text-green-800'
    case 'Adult':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
