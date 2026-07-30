'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, AlertBanner, ConfirmDialog, Skeleton, SkeletonText } from '@/components/ui'
import SmartVisualRenderer from '@/components/admin-toolkit/smart-visual/SmartVisualRenderer'
import type { SmartVisualLayout } from '@/lib/adminToolkitSmartVisualShared'
import {
  saveAdminToolkitSmartVisual,
  removeAdminToolkitSmartVisual,
} from '../smartVisualActions'

type SavedVisual = {
  layout: SmartVisualLayout
  generatedAtIso: string
  isStale: boolean
}

type Preview = {
  layout: SmartVisualLayout
  sourceFingerprint: string
  modelUsed: string | null
}

interface AdminToolkitSmartVisualToggleClientProps {
  surgeryId: string
  itemId: string
  visual: SavedVisual | null
  canGenerate: boolean
  aiVisualsEnabled: boolean
  /** The server-rendered standard content view. */
  children: React.ReactNode
}

function GeneratingSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <Skeleton height="h-4" width="w-2/3" rounded="md" />
        <div className="mt-4">
          <SkeletonText lines={2} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <Skeleton height="h-4" width="w-1/2" rounded="md" />
            <div className="mt-4">
              <SkeletonText lines={3} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminToolkitSmartVisualToggleClient({
  surgeryId,
  itemId,
  visual,
  canGenerate,
  aiVisualsEnabled,
  children,
}: AdminToolkitSmartVisualToggleClientProps) {
  const router = useRouter()

  const hasFreshVisual = Boolean(visual && !visual.isStale)
  const [view, setView] = useState<'standard' | 'visual'>(hasFreshVisual ? 'visual' : 'standard')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  // A saved visual is always shown; the flag only gates generating new ones
  // (superusers arrive with aiVisualsEnabled=true regardless of the flag).
  const canRegenerate = canGenerate && aiVisualsEnabled
  const showControls = visual !== null || canRegenerate
  if (!showControls) {
    return <>{children}</>
  }

  const hasVisualTab = visual !== null || preview !== null || generating

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setPreview(null)
    setView('visual')
    try {
      const response = await fetch('/api/admin-toolkit/smart-visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surgeryId, itemId }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Failed to generate smart visual.')
        if (!visual) setView('standard')
        return
      }
      setPreview({
        layout: data.layout,
        sourceFingerprint: data.sourceFingerprint,
        modelUsed: typeof data.modelUsed === 'string' ? data.modelUsed : null,
      })
    } catch {
      setError('Failed to generate smart visual. Please check your connection and try again.')
      if (!visual) setView('standard')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!preview) return
    setSaving(true)
    setError(null)
    try {
      const result = await saveAdminToolkitSmartVisual({
        surgeryId,
        itemId,
        layout: preview.layout,
        sourceFingerprint: preview.sourceFingerprint,
        modelUsed: preview.modelUsed ?? undefined,
      })
      if (!result.ok) {
        setError(result.error.message)
        if (result.error.code === 'STALE') {
          // Preview no longer matches the source content — force a regenerate.
          setPreview(null)
        }
        return
      }
      setPreview(null)
      router.refresh()
    } catch {
      setError('Failed to save the smart visual. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    setError(null)
    try {
      const result = await removeAdminToolkitSmartVisual({ surgeryId, itemId })
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setConfirmRemoveOpen(false)
      setView('standard')
      router.refresh()
    } catch {
      setError('Failed to remove the smart visual. Please try again.')
    } finally {
      setRemoving(false)
    }
  }

  const segmentButtonClass = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-nhs-blue text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {hasVisualTab ? (
          <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Content view">
            <button
              type="button"
              className={segmentButtonClass(view === 'standard')}
              aria-pressed={view === 'standard'}
              onClick={() => setView('standard')}
            >
              Standard
            </button>
            <button
              type="button"
              className={segmentButtonClass(view === 'visual')}
              aria-pressed={view === 'visual'}
              onClick={() => setView('visual')}
            >
              Smart visual
            </button>
          </div>
        ) : (
          <span />
        )}

        {canGenerate ? (
          <div className="flex items-center gap-2">
            {canRegenerate ? (
              <Button
                variant="secondary"
                size="sm"
                loading={generating}
                onClick={handleGenerate}
                iconLeft={
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                  </svg>
                }
              >
                {visual || preview ? 'Regenerate smart visual' : 'Generate smart visual'}
              </Button>
            ) : null}
            {visual && !preview && !generating ? (
              <Button variant="ghost" size="sm" onClick={() => setConfirmRemoveOpen(true)}>
                Remove visual
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mb-4">
          <AlertBanner variant="error">{error}</AlertBanner>
        </div>
      ) : null}

      {view === 'visual' && visual?.isStale && !preview && !generating ? (
        <div className="mb-4">
          <AlertBanner variant="warning">
            <span>
              This visual was generated from an older version of this page and may be out of date.
              {canRegenerate ? ' Use “Regenerate smart visual” to refresh it.' : ' Check the standard view for the latest content.'}
            </span>
          </AlertBanner>
        </div>
      ) : null}

      {view === 'standard' ? (
        children
      ) : generating ? (
        <div>
          <p className="sr-only" aria-live="polite">
            Generating smart visual…
          </p>
          <GeneratingSkeleton />
        </div>
      ) : preview ? (
        <div className="rounded-xl border-2 border-dashed border-nhs-blue/40 p-4">
          <div className="mb-4">
            <AlertBanner variant="info">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>Preview — not saved yet. Review the layout, then save it or discard it.</span>
                <span className="flex items-center gap-2">
                  <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
                    Save visual
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => {
                      setPreview(null)
                      setError(null)
                      if (!visual) setView('standard')
                    }}
                  >
                    Discard
                  </Button>
                </span>
              </div>
            </AlertBanner>
          </div>
          <SmartVisualRenderer layout={preview.layout} />
        </div>
      ) : visual ? (
        <div>
          <SmartVisualRenderer layout={visual.layout} />
          <p className="mt-4 text-xs text-gray-500">
            Smart visual generated {new Date(visual.generatedAtIso).toLocaleDateString('en-GB')} · The original page
            content remains the source of truth.
          </p>
        </div>
      ) : (
        children
      )}

      <ConfirmDialog
        open={confirmRemoveOpen}
        onClose={() => setConfirmRemoveOpen(false)}
        onConfirm={handleRemove}
        title="Remove smart visual?"
        message="Staff will only see the standard view of this page. The page content itself is not affected."
        confirmLabel="Remove visual"
        loading={removing}
      />
    </div>
  )
}
