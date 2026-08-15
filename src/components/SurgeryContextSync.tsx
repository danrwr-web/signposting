'use client'

import { useEffect } from 'react'
import { useSurgery, type SurgeryState } from '@/context/SurgeryContext'

/**
 * Pushes the server-resolved current surgery into SurgeryContext.
 *
 * The root layout's availableSurgeries is computed once per document load, so
 * it can predate sign-in and miss the surgery the user is now viewing (leaving
 * the context with a nameless placeholder). The /s/[id] layout re-fetches its
 * viewer-scoped list on every navigation and mounts this component with the
 * result, so the value passed here is authoritative for the current page.
 */
export default function SurgeryContextSync({ surgery }: { surgery: SurgeryState | null }) {
  const { syncSurgery } = useSurgery()
  const id = surgery?.id
  const slug = surgery?.slug ?? null
  const name = surgery?.name

  useEffect(() => {
    if (id && name) {
      syncSurgery({ id, slug, name })
    }
  }, [id, slug, name, syncSurgery])

  return null
}
