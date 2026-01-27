'use client'

import { useEffect, useRef } from 'react'

interface WorkflowViewTrackerProps {
  surgeryId: string
  templateId: string
}

const DEBOUNCE_STORAGE_KEY = 'workflow_template_views'
const DEBOUNCE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Client-side component that records a workflow template view event.
 * Debounces to avoid spamming: only records once per template per 5 minutes.
 * Stores debounce timestamps in sessionStorage.
 */
export default function WorkflowViewTracker({
  surgeryId,
  templateId,
}: WorkflowViewTrackerProps) {
  const hasRecorded = useRef(false)

  useEffect(() => {
    if (hasRecorded.current) return

    // Check if we've recently recorded a view for this template
    const now = Date.now()
    let viewTimes: Record<string, number> = {}

    try {
      const stored = sessionStorage.getItem(DEBOUNCE_STORAGE_KEY)
      if (stored) {
        viewTimes = JSON.parse(stored)
      }
    } catch {
      // Ignore parsing errors
    }

    const lastView = viewTimes[templateId]
    if (lastView && now - lastView < DEBOUNCE_DURATION_MS) {
      // Already recorded recently, skip
      return
    }

    // Record the view via API
    hasRecorded.current = true
    fetch('/api/workflow/record-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surgeryId, templateId }),
    })
      .then((res) => {
        if (res.ok) {
          // Update sessionStorage with the new view time
          viewTimes[templateId] = now
          // Clean up old entries (older than debounce duration)
          const cleaned: Record<string, number> = {}
          for (const [id, time] of Object.entries(viewTimes)) {
            if (now - time < DEBOUNCE_DURATION_MS) {
              cleaned[id] = time
            }
          }
          try {
            sessionStorage.setItem(DEBOUNCE_STORAGE_KEY, JSON.stringify(cleaned))
          } catch {
            // Ignore storage errors
          }
        }
      })
      .catch(() => {
        // Silently ignore errors - this is non-critical tracking
      })
  }, [surgeryId, templateId])

  // This component renders nothing
  return null
}
