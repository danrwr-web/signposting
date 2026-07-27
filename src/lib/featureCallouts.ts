/**
 * Time-boxed "new feature" callouts.
 *
 * Each callout key gets a localStorage record on first sight; the callout
 * window stays active for a fixed number of days from that moment, so users
 * see the announcement for a few days after they next use the app, then it
 * disappears on its own. Dismissal hides the intrusive part (the tooltip)
 * immediately but subtle markers (badges) may run for the full window.
 */

export interface CalloutState {
  firstSeen: number
  dismissed: boolean
}

const STORAGE_PREFIX = 'featureCallout:'

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`
}

export function readCalloutState(key: string): CalloutState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.firstSeen !== 'number') return null
    return { firstSeen: parsed.firstSeen, dismissed: parsed.dismissed === true }
  } catch {
    return null
  }
}

/**
 * Read the callout state, recording "first seen = now" if there is none yet.
 */
export function ensureCalloutState(key: string, now: number = Date.now()): CalloutState | null {
  if (typeof window === 'undefined') return null
  const existing = readCalloutState(key)
  if (existing) return existing
  const fresh: CalloutState = { firstSeen: now, dismissed: false }
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(fresh))
  } catch {
    // Storage unavailable (private mode etc.) — treat as unseen every visit.
  }
  return fresh
}

export function isWithinCalloutWindow(
  state: CalloutState | null,
  days: number,
  now: number = Date.now()
): boolean {
  if (!state) return false
  return now < state.firstSeen + days * 24 * 60 * 60 * 1000
}

export function dismissCallout(key: string): void {
  if (typeof window === 'undefined') return
  const state = readCalloutState(key)
  if (!state) return
  try {
    window.localStorage.setItem(
      storageKey(key),
      JSON.stringify({ ...state, dismissed: true })
    )
  } catch {
    // Ignore storage failures; worst case the tooltip reappears next visit.
  }
}
