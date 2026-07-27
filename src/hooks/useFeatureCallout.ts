'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  dismissCallout,
  ensureCalloutState,
  isWithinCalloutWindow,
} from '@/lib/featureCallouts'

/**
 * Drives a time-boxed new-feature callout.
 *
 * - `windowActive`: true for `days` days after the user first loads the app
 *   with this callout present — use for subtle markers like "New" badges.
 * - `tooltipVisible`: true during the window until the user dismisses the
 *   tooltip — use for the one-off spotlight.
 *
 * State lives in localStorage, so it is per browser (a shared reception
 * machine counts as one viewer), and everything is SSR-safe: both flags
 * start false and only flip on the client.
 */
export function useFeatureCallout(key: string, days: number) {
  const [windowActive, setWindowActive] = useState(false)
  const [tooltipVisible, setTooltipVisible] = useState(false)

  useEffect(() => {
    const state = ensureCalloutState(key)
    if (isWithinCalloutWindow(state, days)) {
      setWindowActive(true)
      setTooltipVisible(!state?.dismissed)
    }
  }, [key, days])

  const dismissTooltip = useCallback(() => {
    setTooltipVisible(false)
    dismissCallout(key)
  }, [key])

  return { windowActive, tooltipVisible, dismissTooltip }
}
