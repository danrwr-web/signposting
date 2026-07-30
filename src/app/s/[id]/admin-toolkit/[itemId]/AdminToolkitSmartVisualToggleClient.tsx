'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, AlertBanner, ConfirmDialog, Skeleton, SkeletonText } from '@/components/ui'
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
  itemTitle: string
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

const sectionControlClass =
  'flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500'

export default function AdminToolkitSmartVisualToggleClient({
  surgeryId,
  itemId,
  itemTitle,
  visual,
  canGenerate,
  aiVisualsEnabled,
  children,
}: AdminToolkitSmartVisualToggleClientProps) {
  const router = useRouter()

  // A stale visual (source content edited since generation) is never shown to
  // anyone — it disappears until regenerated. Only a fresh visual is viewable.
  const freshVisual = visual && !visual.isStale ? visual : null
  const staleVisualExists = Boolean(visual && visual.isStale)

  const [view, setView] = useState<'standard' | 'visual'>(freshVisual ? 'visual' : 'standard')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guidance, setGuidance] = useState('')
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  // A fresh saved visual is shown to every viewer; the flag only gates
  // generating new ones (superusers arrive with aiVisualsEnabled=true
  // regardless of the flag). Editors also get controls for a hidden stale
  // visual so they can regenerate or remove it.
  const canRegenerate = canGenerate && aiVisualsEnabled

  const handleGenerate = async (guidanceText?: string) => {
    setGenerating(true)
    setError(null)
    setPreview(null)
    setView('visual')
    try {
      const trimmedGuidance = guidanceText?.trim()
      const response = await fetch('/api/admin-toolkit/smart-visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surgeryId,
          itemId,
          ...(trimmedGuidance ? { guidance: trimmedGuidance } : {}),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Failed to generate smart visual.')
        if (!freshVisual) setView('standard')
        return
      }
      setPreview({
        layout: data.layout,
        sourceFingerprint: data.sourceFingerprint,
        modelUsed: typeof data.modelUsed === 'string' ? data.modelUsed : null,
      })
    } catch {
      setError('Failed to generate smart visual. Please check your connection and try again.')
      if (!freshVisual) setView('standard')
    } finally {
      setGenerating(false)
    }
  }

  // Arriving with ?regenerateVisual=1 (e.g. from the "Regenerate now" prompt
  // shown after editing the page) kicks off generation immediately.
  const autoRegenTriggered = useRef(false)
  useEffect(() => {
    if (autoRegenTriggered.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('regenerateVisual') !== '1') return
    autoRegenTriggered.current = true
    params.delete('regenerateVisual')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
    if (canRegenerate) void handleGenerate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showControls = freshVisual !== null || canRegenerate || (staleVisualExists && canGenerate)
  if (!showControls) {
    return <>{children}</>
  }

  const hasVisualTab = freshVisual !== null || preview !== null || generating

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

  const handlePrint = () => {
    document.body.classList.add('smart-visual-printing')
    const cleanup = () => {
      document.body.classList.remove('smart-visual-printing')
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
    // Safety net for browsers that don't fire afterprint reliably.
    setTimeout(cleanup, 3000)
  }

  const movePreviewSection = (index: number, delta: -1 | 1) => {
    setPreview((current) => {
      if (!current) return current
      const target = index + delta
      if (target < 0 || target >= current.layout.sections.length) return current
      const sections = [...current.layout.sections]
      const [moved] = sections.splice(index, 1)
      sections.splice(target, 0, moved)
      return { ...current, layout: { ...current.layout, sections } }
    })
  }

  const removePreviewSection = (index: number) => {
    setPreview((current) => {
      if (!current || current.layout.sections.length <= 1) return current
      const sections = current.layout.sections.filter((_, i) => i !== index)
      return { ...current, layout: { ...current.layout, sections } }
    })
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

        <div className="flex items-center gap-2">
          {view === 'visual' && freshVisual && !preview && !generating ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
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
                  <path d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659" />
                </svg>
              }
            >
              Print visual
            </Button>
          ) : null}

          {canGenerate ? (
            <>
              {canRegenerate ? (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={generating}
                  onClick={() => handleGenerate()}
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
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mb-4">
          <AlertBanner variant="error">{error}</AlertBanner>
        </div>
      ) : null}

      {staleVisualExists && canGenerate && !preview && !generating ? (
        <div className="mb-4">
          <AlertBanner variant="warning">
            <span>
              This page has been edited since its smart visual was generated, so the visual is hidden from staff
              until it is regenerated.
              {canRegenerate ? ' Use “Regenerate smart visual” to create an up-to-date version.' : ''}
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
                <span>
                  Preview — not saved yet. Reorder or remove sections, refine with guidance, then save or discard.
                </span>
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
                      if (!freshVisual) setView('standard')
                    }}
                  >
                    Discard
                  </Button>
                </span>
              </div>
            </AlertBanner>
          </div>

          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <label htmlFor="smart-visual-guidance" className="sr-only">
                Guidance for the AI
              </label>
              <Input
                id="smart-visual-guidance"
                value={guidance}
                maxLength={500}
                onChange={(e) => setGuidance(e.target.value)}
                placeholder='Optional: tell the AI how to adjust — e.g. "group by site" or "make the warning more prominent"'
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={generating}
              disabled={saving}
              onClick={() => handleGenerate(guidance)}
              className="sm:self-center"
            >
              Regenerate{guidance.trim() ? ' with guidance' : ''}
            </Button>
          </div>

          <div className="space-y-5">
            {preview.layout.sections.map((section, i) => {
              const single: SmartVisualLayout = { version: 1, sections: [section] }
              return (
                <div key={`${section.type}-${i}`} className="relative">
                  <div className="absolute right-2 top-2 z-10 flex gap-0.5 rounded-md border border-gray-200 bg-white/95 p-0.5 shadow-sm">
                    <button
                      type="button"
                      aria-label="Move section up"
                      title="Move section up"
                      disabled={i === 0}
                      onClick={() => movePreviewSection(i, -1)}
                      className={sectionControlClass}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label="Move section down"
                      title="Move section down"
                      disabled={i === preview.layout.sections.length - 1}
                      onClick={() => movePreviewSection(i, 1)}
                      className={sectionControlClass}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label="Remove section"
                      title={preview.layout.sections.length <= 1 ? 'A visual needs at least one section' : 'Remove section'}
                      disabled={preview.layout.sections.length <= 1}
                      onClick={() => removePreviewSection(i)}
                      className={sectionControlClass}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <SmartVisualRenderer layout={single} />
                </div>
              )
            })}
          </div>
        </div>
      ) : freshVisual ? (
        <div className="smart-visual-print-area">
          <div className="hidden print:block mb-4">
            <h1 className="text-2xl font-bold text-nhs-dark-blue">{itemTitle}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Practice Handbook smart visual · generated {new Date(freshVisual.generatedAtIso).toLocaleDateString('en-GB')}
            </p>
          </div>
          <SmartVisualRenderer layout={freshVisual.layout} />
          <p className="mt-4 text-xs text-gray-500 print:hidden">
            Smart visual generated {new Date(freshVisual.generatedAtIso).toLocaleDateString('en-GB')} · The original
            page content remains the source of truth.
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
