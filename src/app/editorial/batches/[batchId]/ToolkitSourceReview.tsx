'use client'

import { useEffect, useState } from 'react'

type SourceSymptom = {
  id: string
  name: string
  ageGroup: string | null
  briefInstruction: string | null
  instructionsText: string
  highlightedText: string | null
  sourceUrl: string
}

type SourceReviewPayload = {
  applicable: boolean
  mode?: 'snapshot' | 'current'
  generatedAt?: string
  capturedAt?: string | null
  matchedSymptoms?: string[]
  fallbackUsed?: boolean
  fallbackReason?: string | null
  snapshotContext?: string | null
  symptoms?: SourceSymptom[]
  error?: { message?: string }
}

export default function ToolkitSourceReview({ batchId, surgeryId }: { batchId: string; surgeryId: string }) {
  const [payload, setPayload] = useState<SourceReviewPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/editorial/batches/${batchId}/source-review?surgeryId=${encodeURIComponent(surgeryId)}`,
          { cache: 'no-store' },
        )
        const body = (await response.json().catch(() => ({}))) as SourceReviewPayload
        if (!response.ok) {
          throw new Error(body.error?.message || 'Unable to load Toolkit source review')
        }
        if (!cancelled) setPayload(body)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load Toolkit source review')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [batchId, surgeryId])

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Loading Signposting Toolkit source cross-check…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        Toolkit source cross-check could not be loaded: {error}
      </div>
    )
  }

  if (!payload?.applicable) return null

  const symptoms = payload.symptoms || []
  const matchedSymptoms = payload.matchedSymptoms || []

  return (
    <section className="rounded-xl border border-nhs-blue/25 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 bg-nhs-light-blue/30 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-nhs-dark-blue">Toolkit source cross-check</h2>
          <p className="mt-1 text-sm text-slate-600">
            Use this alongside the generated card below to check that the AI has interpreted the approved Signposting Toolkit correctly.
          </p>
        </div>
        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${payload.mode === 'snapshot' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {payload.mode === 'snapshot' ? 'Source snapshot' : 'Current Toolkit wording'}
        </span>
      </div>

      <div className="space-y-4 p-5">
        {payload.mode === 'current' && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            This older batch did not store a full historical Toolkit snapshot. The wording shown here is the current approved Toolkit content for the symptom pages that the generator recorded as matches. If the Toolkit has changed since generation, review against the current wording and edit or regenerate the card as needed.
          </div>
        )}

        {payload.fallbackUsed && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <span className="font-semibold">Generator fallback was used.</span>{' '}
            {payload.fallbackReason || 'No specific Toolkit symptom guidance was recorded for this batch.'}
          </div>
        )}

        {payload.mode === 'snapshot' && payload.snapshotContext ? (
          <details open className="rounded-lg border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
              Exact Toolkit context supplied to the generator
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              <pre className="whitespace-pre-wrap font-sans text-xs leading-5 text-slate-700">{payload.snapshotContext}</pre>
            </div>
          </details>
        ) : symptoms.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Matched at generation: {matchedSymptoms.join(', ')}
            </p>
            {symptoms.map((symptom, index) => (
              <details key={symptom.id} open={index === 0} className="rounded-lg border border-slate-200 bg-slate-50">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">
                  {symptom.name}{symptom.ageGroup ? ` · ${symptom.ageGroup}` : ''}
                </summary>
                <div className="space-y-3 border-t border-slate-200 px-4 py-4">
                  {symptom.briefInstruction && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Brief instruction</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">{symptom.briefInstruction}</p>
                    </div>
                  )}
                  {symptom.instructionsText && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Full Toolkit instruction</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{symptom.instructionsText}</p>
                    </div>
                  )}
                  {symptom.highlightedText && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Highlighted / key text</p>
                      <p className="mt-1 text-sm text-slate-700">{symptom.highlightedText}</p>
                    </div>
                  )}
                  <a
                    href={symptom.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-xs font-semibold text-nhs-blue hover:underline"
                  >
                    Open this source page in the Signposting Toolkit ↗
                  </a>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            No specific Toolkit symptom pages were recorded as matches for this batch. Treat the card as needing a manual source check before approval.
          </div>
        )}

        <p className="text-xs text-slate-500">
          This panel is read-only. It does not alter the Signposting Toolkit or the generated card.
        </p>
      </div>
    </section>
  )
}
