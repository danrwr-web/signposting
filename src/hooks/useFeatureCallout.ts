'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  dismissCallout,
  ensureCalloutState,
  isWithinCalloutWindow,
  readCalloutState,
  type CalloutState,
} from '@/lib/featureCallouts'

interface ServerCalloutState {
  firstSeen: number
  dismissed: boolean
}

// Session-length cache + in-flight dedupe so several components using the
// same callout key (badge + tooltip) share one request per page load.
const stateCache = new Map<string, ServerCalloutState>()
const inflight = new Map<string, Promise<ServerCalloutState | null>>()

// Broadcast dismissals so other hook instances watching the same key update
// immediately (e.g. a dependent callout waiting for this one to be dismissed).
const DISMISS_EVENT = 'featureCalloutDismissed'

async function fetchServerState(
  key: string,
  markDismissed: boolean
): Promise<ServerCalloutState | null> {
  const cached = stateCache.get(key)
  if (cached) return cached

  const pending = inflight.get(key)
  if (pending) return pending

  const promise = (async (): Promise<ServerCalloutState | null> => {
    try {
      const response = await fetch('/api/callouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, action: markDismissed ? 'dismiss' : 'seen' }),
      })
      if (!response.ok) return null
      const data = await response.json()
      const state: ServerCalloutState = {
        firstSeen: new Date(data.callout.firstSeenAt).getTime(),
        dismissed: data.callout.dismissedAt !== null,
      }
      stateCache.set(key, state)
      return state
    } catch {
      return null
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, promise)
  return promise
}

export interface FeatureCalloutOptions {
  /**
   * A pre-existing localStorage flag from the old per-browser mechanism
   * (e.g. 'hasSeenNavUpdate'). When present in this browser, the callout is
   * treated as dismissed and that fact is seeded into the user's server-side
   * record, so it stays dismissed on their other machines too.
   */
  legacySeenKey?: string
}

/**
 * Drives a "new feature" callout backed by per-user server-side state
 * (UserCalloutState), so seen/dismissed follows the user across devices.
 *
 * - `windowActive`: true while the callout should be marked (e.g. a "New"
 *   badge): until dismissed, and — when `days` is set — for at most that many
 *   days after the user first loads the app with this callout present.
 * - `tooltipVisible`: same condition — use for the one-off spotlight.
 *
 * Falls back to *reading* localStorage when there is no usable server state
 * (offline, signed out) and treats unknown state as not new, so a failed
 * request can never announce — or re-announce — a feature. Both flags start
 * false so server rendering is unaffected. `resolved` flips true once the
 * state has been determined — use it to sequence dependent callouts.
 */
export function useFeatureCallout(
  key: string,
  days?: number,
  options?: FeatureCalloutOptions
) {
  const [windowActive, setWindowActive] = useState(false)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [resolved, setResolved] = useState(false)
  const legacySeenKey = options?.legacySeenKey
  const { status: sessionStatus } = useSession()

  useEffect(() => {
    // Callout state is per-user; until the session has hydrated we don't know
    // whose state to read, so stay unresolved (the effect re-runs on change).
    if (sessionStatus === 'loading') return

    let cancelled = false

    const resolve = async () => {
      let legacyDismissed = false
      if (legacySeenKey) {
        try {
          legacyDismissed = window.localStorage.getItem(legacySeenKey) !== null
        } catch {
          // Storage unavailable — proceed without legacy seeding.
        }
      }

      // Signed out (the nav trigger also mounts on public pages): the API
      // requires a session, so don't call it at all.
      const serverState =
        sessionStatus === 'authenticated'
          ? await fetchServerState(key, legacyDismissed)
          : null
      if (cancelled) return

      let state: CalloutState | null
      if (serverState) {
        state = serverState
      } else {
        // No usable server state — read the per-browser fallback, but never
        // write one here: anchoring "first seen = now" after a failed request
        // would silently re-announce the callout for another full window.
        state = readCalloutState(key)
        if (state && legacyDismissed) {
          state = { ...state, dismissed: true }
        }
      }

      const inWindow =
        days === undefined ? state !== null : isWithinCalloutWindow(state, days)
      const active = inWindow && !state?.dismissed
      setWindowActive(active)
      setTooltipVisible(active)
      setResolved(true)
    }

    resolve()
    return () => {
      cancelled = true
    }
  }, [key, days, legacySeenKey, sessionStatus])

  // React to this callout being dismissed via another hook instance
  useEffect(() => {
    const handleDismissed = (event: Event) => {
      if ((event as CustomEvent<{ key: string }>).detail?.key !== key) return
      setTooltipVisible(false)
      setWindowActive(false)
    }
    window.addEventListener(DISMISS_EVENT, handleDismissed)
    return () => window.removeEventListener(DISMISS_EVENT, handleDismissed)
  }, [key])

  const dismissTooltip = useCallback(() => {
    setTooltipVisible(false)
    setWindowActive(false)

    const cached = stateCache.get(key)
    if (cached) {
      stateCache.set(key, { ...cached, dismissed: true })
    }
    window.dispatchEvent(new CustomEvent(DISMISS_EVENT, { detail: { key } }))
    // Persist locally too, as the offline fallback.
    ensureCalloutState(key)
    dismissCallout(key)

    fetch('/api/callouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, action: 'dismiss' }),
    }).catch(() => {
      // Local fallback already recorded the dismissal.
    })
  }, [key])

  return { windowActive, tooltipVisible, resolved, dismissTooltip }
}
