import {
  formatAgeGroupLabel,
  formatAgeGroupDescription,
  ageGroupBadgeClasses,
  SYMPTOM_AGE_GROUPS,
} from '@/lib/ageGroups'

describe('ageGroups helpers', () => {
  it('formats short labels for each age group', () => {
    expect(formatAgeGroupLabel('U5')).toBe('Under 5')
    expect(formatAgeGroupLabel('O5')).toBe('5–17')
    expect(formatAgeGroupLabel('Adult')).toBe('Adult')
  })

  it('falls back gracefully for unknown or missing age groups', () => {
    expect(formatAgeGroupLabel(null)).toBe('All ages')
    expect(formatAgeGroupLabel(undefined)).toBe('All ages')
    expect(formatAgeGroupLabel('Teen')).toBe('Teen')
    expect(formatAgeGroupDescription(null)).toBe('all ages')
  })

  it('formats long-form descriptions', () => {
    expect(formatAgeGroupDescription('U5')).toBe('children under 5')
    expect(formatAgeGroupDescription('O5')).toBe('children and young people aged 5–17')
    expect(formatAgeGroupDescription('Adult')).toBe('adults')
  })

  it('gives each age group a distinct badge colour', () => {
    const classes = SYMPTOM_AGE_GROUPS.map(ageGroupBadgeClasses)
    expect(new Set(classes).size).toBe(SYMPTOM_AGE_GROUPS.length)
    expect(ageGroupBadgeClasses('U5')).toContain('blue')
    expect(ageGroupBadgeClasses('O5')).toContain('green')
    expect(ageGroupBadgeClasses('Adult')).toContain('purple')
    expect(ageGroupBadgeClasses(null)).toContain('gray')
  })
})
