/**
 * Time-boxed "new feature" callouts — per-browser fallback store.
 *
 * The authoritative per-user state lives on the server (UserCalloutState, via
 * useFeatureCallout); these helpers are the localStorage mirror used when
 * there is no usable server state (offline, signed out). Readers must fail
 * closed: no record means "not new". Never write a record just to anchor a
 * window after a failed request — that silently re-announces the callout.
 * Dismissal (explicit, or by engaging with the feature) hides tooltip and
 * badges alike; otherwise a `days` window expires the callout on its own.
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
