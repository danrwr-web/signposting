import {
  dismissCallout,
  ensureCalloutState,
  isWithinCalloutWindow,
  readCalloutState,
} from '../featureCallouts'

const KEY = 'test-callout'
const DAY_MS = 24 * 60 * 60 * 1000

describe('featureCallouts', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('records first-seen on first sight and keeps it stable afterwards', () => {
    const first = ensureCalloutState(KEY, 1000)
    expect(first).toEqual({ firstSeen: 1000, dismissed: false })

    const second = ensureCalloutState(KEY, 999999)
    expect(second?.firstSeen).toBe(1000)
  })

  it('window is active for the given number of days from first sight', () => {
    const state = ensureCalloutState(KEY, 0)
    expect(isWithinCalloutWindow(state, 5, 4 * DAY_MS)).toBe(true)
    expect(isWithinCalloutWindow(state, 5, 5 * DAY_MS)).toBe(false)
    expect(isWithinCalloutWindow(null, 5, 0)).toBe(false)
  })

  it('dismissal persists without resetting the window', () => {
    ensureCalloutState(KEY, 1000)
    dismissCallout(KEY)
    const state = readCalloutState(KEY)
    expect(state).toEqual({ firstSeen: 1000, dismissed: true })
    expect(isWithinCalloutWindow(state, 5, 1000 + DAY_MS)).toBe(true)
  })

  it('treats corrupt storage as unseen', () => {
    window.localStorage.setItem(`featureCallout:${KEY}`, 'not-json')
    expect(readCalloutState(KEY)).toBeNull()
    const state = ensureCalloutState(KEY, 42)
    expect(state).toEqual({ firstSeen: 42, dismissed: false })
  })
})
