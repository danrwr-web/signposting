'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { playNotificationSound } from '@/lib/notificationSound'
import { BulkGenerationProgress } from './library/BulkGenerationProgress'

const BULK_POLL_INTERVAL_MS = 5000
const STORAGE_KEY_PREFIX = 'editorial-bulk-run-'

function getStorageKey(surgeryId: string) {
  return `${STORAGE_KEY_PREFIX}${surgeryId}`
}

export function EditorialBulkProgressBanner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const surgeryId = searchParams.get('surgery') ?? ''
  const bulkRunIdFromUrl = searchParams.get('bulkRunId')

  const [activeBulkRunId, setActiveBulkRunId] = useState<string | null>(null)
  const [bulkRunStatus, setBulkRunStatus] = useState<{
    status: string
    totalSubsections: number
    completedCount: number
    failedCount: number
    failedSubsections: Array<{ categoryName: string; subsection: string }>
  } | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  // Only show on editorial routes
  const isEditorial = pathname.startsWith('/editorial')

  // Resolve bulkRunId from URL or sessionStorage
  useEffect(() => {
    if (!isEditorial || !surgeryId) return

    const fromUrl = bulkRunIdFromUrl
    const fromStorage =
      typeof window !== 'undefined' ? sessionStorage.getItem(getStorageKey(surgeryId)) : null
    const id = fromUrl ?? fromStorage
    if (id && id !== activeBulkRunId) {
      setActiveBulkRunId(id)
      if (typeof window !== 'undefined' && !fromUrl) {
        sessionStorage.setItem(getStorageKey(surgeryId), id)
      }
    }
  }, [isEditorial, surgeryId, bulkRunIdFromUrl, activeBulkRunId])

  // Poll for status
  useEffect(() => {
    if (!activeBulkRunId || !surgeryId) return

    const clearStorage = () => {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(getStorageKey(surgeryId))
      }
    }

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/editorial/bulk-generate/status?bulkRunId=${activeBulkRunId}`,
          { cache: 'no-store' }
        )
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || !payload?.ok) return

        setBulkRunStatus({
          status: payload.status,
          totalSubsections: payload.totalSubsections ?? 0,
          completedCount: payload.completedCount ?? 0,
          failedCount: payload.failedCount ?? 0,
          failedSubsections: payload.failedSubsections ?? [],
        })

        if (payload.status === 'COMPLETE') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
          clearStorage()
          setActiveBulkRunId(null)
          // Only show toast from banner when not on library (library shows its own)
          const isOnLibrary = pathnameRef.current === '/editorial/library'
          if (!isOnLibrary) {
            playNotificationSound()
            const created = payload.completedCount ?? 0
            const failed = payload.failedCount ?? 0
            if (failed > 0) {
              toast.success(`Bulk generation complete. ${created} cards created, ${failed} failed.`, {
                duration: 6000,
                icon: '✨',
              })
            } else {
              toast.success(`Bulk generation complete. ${created} cards created.`, {
                duration: 5000,
                icon: '✨',
              })
            }
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('Daily Dose', {
                body: `Bulk generation complete. ${created} cards created.`,
                icon: '/favicon.ico',
              })
            }
          }
        }

        if (payload.status === 'CANCELLED') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
          clearStorage()
          setActiveBulkRunId(null)
          const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
          params.delete('bulkRunId')
          router.replace(params.toString() ? `?${params.toString()}` : pathnameRef.current, { scroll: false })
          if (pathnameRef.current !== '/editorial/library') {
            toast('Bulk generation was stopped.')
          }
        }
      } catch {
        // Ignore
      }
    }

    poll()
    pollIntervalRef.current = setInterval(poll, BULK_POLL_INTERVAL_MS)
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [activeBulkRunId, surgeryId])

  const handleCancel = async () => {
    if (!activeBulkRunId) return
    setCancelLoading(true)
    try {
      const response = await fetch('/api/editorial/bulk-generate/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulkRunId: activeBulkRunId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        toast.error(payload?.error ?? 'Unable to cancel bulk generation')
        return
      }
      setBulkRunStatus((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null))
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(getStorageKey(surgeryId))
      }
      setActiveBulkRunId(null)
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
      params.delete('bulkRunId')
      router.replace(params.toString() ? `?${params.toString()}` : pathname, { scroll: false })
      toast.success('Bulk generation stopped. Remaining jobs will not run.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel')
    } finally {
      setCancelLoading(false)
    }
  }

  if (!isEditorial || !surgeryId || !activeBulkRunId) return null

  return (
    <div className="mb-4">
      <BulkGenerationProgress
        bulkRunStatus={bulkRunStatus}
        canAdmin
        cancelLoading={cancelLoading}
        onCancel={handleCancel}
      />
    </div>
  )
}
