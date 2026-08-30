import {
  INTERNAL_ENGAGEMENT_REFS,
  firstParam,
  isInternalEngagementRef,
} from '@/lib/engagementRefs'

describe('firstParam', () => {
  it('normalises the repeated-param form', () => {
    expect(firstParam(['a', 'b'])).toBe('a')
    expect(firstParam('a')).toBe('a')
    expect(firstParam(undefined)).toBeUndefined()
    expect(firstParam(null)).toBeUndefined()
    expect(firstParam([])).toBeUndefined()
  })
})

describe('isInternalEngagementRef', () => {
  it('treats an ordinary visit as countable', () => {
    expect(isInternalEngagementRef(undefined, undefined)).toBe(false)
    expect(isInternalEngagementRef('search', undefined)).toBe(false)
  })

  it('excludes clinical review traffic from either param', () => {
    // ClinicalReviewPanel links with ref= from the review table and from= on
    // the "Open symptom page" button; both are review traffic.
    expect(isInternalEngagementRef('clinical-review', undefined)).toBe(true)
    expect(isInternalEngagementRef(undefined, 'clinical-review')).toBe(true)
  })

  it('excludes superuser suggestion triage', () => {
    expect(isInternalEngagementRef('suggestions', undefined)).toBe(true)
  })

  it('handles the repeated-param form', () => {
    expect(isInternalEngagementRef(['clinical-review'], undefined)).toBe(true)
  })

  it('keeps the two link params in sync with one list', () => {
    for (const ref of INTERNAL_ENGAGEMENT_REFS) {
      expect(isInternalEngagementRef(ref, undefined)).toBe(true)
      expect(isInternalEngagementRef(undefined, ref)).toBe(true)
    }
  })
})
