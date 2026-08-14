'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, AlertBanner, ConfirmDialog, Skeleton, SkeletonText } from '@/components/ui'
import SymptomSmartVisualRenderer from './SymptomSmartVisualRenderer'
import type { SymptomSmartVisualLayout } from '@/lib/symptomSmartVisualShared'

/**
 * The save/remove server actions are imported lazily, inside the handlers that
 * call them. A static import would put the action module — and through it the
 * whole auth/Prisma chain it gates on — into the static graph of every
 * consumer of this component, which breaks any test that renders
 * InstructionView. Next resolves `'use server'` exports to client action
 * references either way, so nothing about the production behaviour changes.
 */
const smartVisualActions = () => import('@/app/s/[id]/signposting/symptomSmartVisualActions')

export type SavedSymptomVisual = {
  variantKey: string
  layout: SymptomSmartVisualLayout
  generatedAtIso: string
  isStale: boolean
}

export type SymptomSmartVisualProps = {
  surgeryId: string
  /** Effective symptom id the visual is keyed by (base id for overrides). */
  symptomId: string
  visuals: SavedSymptomVisual[]
  /** The viewer can generate and save visuals (practice admin or superuser). */
  canGenerate: boolean
  /** ai_symptom_visuals is on for this surgery (or the viewer is a superuser). */
  aiVisualsEnabled: boolean
  /** The symptom's clinical review status for this surgery is APPROVED. */
  approved: boolean
}

interface SymptomSmartVisualToggleProps extends SymptomSmartVisualProps {
  /** '' for the symptom's main instructions, else the selected variant key. */
  activeVariantKey: string
  /** Label of the active variant, for the empty/pending copy. */
  activeVariantLabel: string | null
  /** Hidden entirely while the instructions are being edited. */
  disabled?: boolean
  /** The standard rendered instruction body. */
  children: React.ReactNode
}

type Preview = {
  layout: SymptomSmartVisualLayout
  sourceFingerprint: string
  variantKey: string
  modelUsed: string | null
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

/**
 * Wraps the standard instruction body with a Standard / Smart visual toggle.
 *
 * Two rules differ from the Practice Handbook equivalent:
 *  - visuals are per age-group variant, so switching variant swaps (or hides)
 *    the visual rather than showing one generated from other wording;
 *  - a saved visual only reaches staff once the symptom has passed clinical
 *    review. Editors can see an unapproved visual, badged as pending.
 */
export default function SymptomSmartVisualToggle({
  surgeryId,
  symptomId,
  visuals,
  canGenerate,
  aiVisualsEnabled,
  approved,
  activeVariantKey,
  activeVariantLabel,
  disabled = false,
  children,
}: SymptomSmartVisualToggleProps) {
  const router = useRouter()

  const visualForVariant = useMemo(
    () => visuals.find((v) => v.variantKey === activeVariantKey) ?? null,
    [visuals, activeVariantKey]
  )

  // A stale visual (instructions edited since generation) is never shown to
  // anyone; an unapproved one is hidden from everyone who cannot edit.
  const freshVisual = visualForVariant && !visualForVariant.isStale ? visualForVariant : null
  const staleVisualExists = Boolean(visualForVariant && visualForVariant.isStale)
  const viewableVisual = freshVisual && (approved || canGenerate) ? freshVisual : null
  const awaitingApproval = Boolean(freshVisual && !approved)

  const [view, setView] = useState<'standard' | 'visual'>('standard')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guidance, setGuidance] = useState('')
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  // Which variant is selected right now, readable from inside an in-flight
  // request whose closure captured an older value.
  const activeVariantKeyRef = useRef(activeVariantKey)

  // Switching age-group variant must never leave the previous variant's visual
  // (or a preview generated from its wording) on screen.
  useEffect(() => {
    activeVariantKeyRef.current = activeVariantKey
    setPreview(null)
    setError(null)
    setView('standard')
  }, [activeVariantKey])

  const canRegenerate = canGenerate && aiVisualsEnabled

  const handleGenerate = async (guidanceText?: string) => {
    // Pin the variant this request is for. Generation takes seconds, and if the
    // admin switches age group meanwhile, a late response must not paint the
    // previous variant's triage content under the newly selected one — they
    // could then review and save it believing it describes the other age group.
    const requestedVariantKey = activeVariantKey
    const isStaleResponse = () => activeVariantKeyRef.current !== requestedVariantKey

    setGenerating(true)
    setError(null)
    setView('visual')
    // Keep any current preview (including manual reorder/remove edits) until a
    // successful response replaces it — a failed regeneration must not throw
    // away a previously valid, still-saveable preview.
    const hadPreview = preview !== null
    try {
      const trimmedGuidance = guidanceText?.trim()
      const response = await fetch('/api/symptoms/smart-visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surgeryId,
          symptomId,
          variantKey: requestedVariantKey,
          ...(trimmedGuidance ? { guidance: trimmedGuidance } : {}),
        }),
      })
      const data = await response.json()
      if (isStaleResponse()) return
      if (!response.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Failed to generate smart visual.')
        if (!viewableVisual && !hadPreview) setView('standard')
        return
      }
      setPreview({
        layout: data.layout,
        sourceFingerprint: data.sourceFingerprint,
        variantKey: typeof data.variantKey === 'string' ? data.variantKey : requestedVariantKey,
        modelUsed: typeof data.modelUsed === 'string' ? data.modelUsed : null,
      })
    } catch {
      if (isStaleResponse()) return
      setError('Failed to generate smart visual. Please check your connection and try again.')
      if (!viewableVisual && !hadPreview) setView('standard')
    } finally {
      // Always clears: the spinner belongs to this request either way, and only
      // one generation can be in flight (the button is disabled while loading).
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!preview) return
    setSaving(true)
    setError(null)
    try {
      const { saveSymptomSmartVisual } = await smartVisualActions()
      const result = await saveSymptomSmartVisual({
        surgeryId,
        symptomId,
        variantKey: preview.variantKey,
        layout: preview.layout,
        sourceFingerprint: preview.sourceFingerprint,
        modelUsed: preview.modelUsed ?? undefined,
      })
      if (!result.ok) {
        setError(result.error.message)
        if (result.error.code === 'STALE') {
          // Preview no longer matches the instructions — force a regenerate.
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
      const { removeSymptomSmartVisual } = await smartVisualActions()
      const result = await removeSymptomSmartVisual({
        surgeryId,
        symptomId,
        variantKey: activeVariantKey,
      })
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

  // While editing there is nothing to toggle between — the editor owns the card.
  if (disabled) return <>{children}</>

  const showControls = viewableVisual !== null || canRegenerate || (staleVisualExists && canGenerate)
  if (!showControls) return <>{children}</>

  const hasVisualTab = viewableVisual !== null || preview !== null || generating

  const segmentButtonClass = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-nhs-blue text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`

  const variantSuffix = activeVariantLabel ? ` for ${activeVariantLabel}` : ''

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {hasVisualTab ? (
          <div
            className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1"
            role="group"
            aria-label="Instructions view"
          >
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
                {visualForVariant || preview ? 'Regenerate smart visual' : 'Generate smart visual'}
              </Button>
            ) : null}
            {visualForVariant && !preview && !generating ? (
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

      {staleVisualExists && canGenerate && !preview && !generating ? (
        <div className="mb-4">
          <AlertBanner variant="warning">
            <span>
              These instructions have been edited since the smart visual{variantSuffix} was
              generated, so the visual is hidden from staff until it is regenerated.
              {canRegenerate ? ' Use “Regenerate smart visual” to create an up-to-date version.' : ''}
            </span>
          </AlertBanner>
        </div>
      ) : null}

      {awaitingApproval && canGenerate && !preview && !generating ? (
        <div className="mb-4">
          <AlertBanner variant="info">
            <span>
              This smart visual is awaiting clinical approval, so staff still see the standard
              instructions. It becomes visible to everyone once a clinician approves this symptom.
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
                  Preview — not saved yet. Reorder or remove sections, refine with guidance, then
                  save or discard. Saving sends this symptom for clinical review.
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
                      if (!viewableVisual) setView('standard')
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
              <label htmlFor="symptom-smart-visual-guidance" className="sr-only">
                Guidance for the AI
              </label>
              <Input
                id="symptom-smart-visual-guidance"
                value={guidance}
                maxLength={500}
                onChange={(e) => setGuidance(e.target.value)}
                placeholder='Optional: tell the AI how to adjust — e.g. "make the routing options clearer" or "pull the red flags to the top"'
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
              const single: SymptomSmartVisualLayout = { version: 1, sections: [section] }
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
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
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
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label="Remove section"
                      title={
                        preview.layout.sections.length <= 1
                          ? 'A visual needs at least one section'
                          : 'Remove section'
                      }
                      disabled={preview.layout.sections.length <= 1}
                      onClick={() => removePreviewSection(i)}
                      className={sectionControlClass}
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <SymptomSmartVisualRenderer layout={single} />
                </div>
              )
            })}
          </div>
        </div>
      ) : viewableVisual ? (
        <div>
          <SymptomSmartVisualRenderer layout={viewableVisual.layout} />
          <p className="mt-4 text-xs text-gray-500">
            Smart visual generated{' '}
            {new Date(viewableVisual.generatedAtIso).toLocaleDateString('en-GB')} · The written
            instructions remain the source of truth.
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
        message="Staff will only see the standard instructions for this symptom. The instructions themselves are not affected."
        confirmLabel="Remove visual"
        loading={removing}
      />
    </div>
  )
}
