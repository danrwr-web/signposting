'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  dismissCallout,
  ensureCalloutState,
  isWithinCalloutWindow,
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
 * - `windowActive`: with `days` set, true for that many days after the user
 *   first loads the app with this callout present — use for subtle markers
 *   like "New" badges. Without `days`, true until dismissed.
 * - `tooltipVisible`: true during the window until dismissed — use for the
 *   one-off spotlight.
 *
 * Falls back to localStorage when the API is unreachable, and both flags
 * start false so server rendering is unaffected. `resolved` flips true once
 * the state has been determined — use it to sequence dependent callouts.
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

  useEffect(() => {
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

      const serverState = await fetchServerState(key, legacyDismissed)
      if (cancelled) return

      let state: CalloutState | null
      if (serverState) {
        state = serverState
      } else {
        // API unavailable (offline, unauthenticated) — per-browser fallback.
        state = ensureCalloutState(key)
        if (state && legacyDismissed) {
          state = { ...state, dismissed: true }
        }
      }

      const inWindow =
        days === undefined ? state !== null : isWithinCalloutWindow(state, days)
      setWindowActive(days === undefined ? inWindow && !state?.dismissed : inWindow)
      setTooltipVisible(inWindow && !state?.dismissed)
      setResolved(true)
    }

    resolve()
    return () => {
      cancelled = true
    }
  }, [key, days, legacySeenKey])

  const dismissTooltip = useCallback(() => {
    setTooltipVisible(false)
    if (days === undefined) {
      setWindowActive(false)
    }

    const cached = stateCache.get(key)
    if (cached) {
      stateCache.set(key, { ...cached, dismissed: true })
    }
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
  }, [key, days])

  return { windowActive, tooltipVisible, resolved, dismissTooltip }
}
