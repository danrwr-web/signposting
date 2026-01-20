'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface EditorialGeneratorClientProps {
  surgeryId: string
}

interface PromptTrace {
  traceId: string
  createdAt: string
  toolkitInjected: boolean
  matchedSymptoms: string[]
  toolkitContextLength: number
  promptSystem: string
  promptUser: string
  modelRawText?: string
  modelRawJson?: unknown
  modelNormalisedJson?: unknown
  validationErrors?: unknown
  sources?: unknown
  safetyValidationPassed?: boolean
  safetyValidationErrors?: Array<{ code: string; message: string; cardTitle?: string }>
}

export default function EditorialGeneratorClient({ surgeryId }: EditorialGeneratorClientProps) {
  const router = useRouter()
  const [promptText, setPromptText] = useState('')
  const [targetRole, setTargetRole] = useState('ADMIN')
  const [count, setCount] = useState(5)
  const [tags, setTags] = useState('')
  const [interactiveFirst, setInteractiveFirst] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<{
    requestId?: string
    traceId?: string
    issues: Array<{ path: string; message: string }>
    rawSnippet?: string
  } | null>(null)
  const [traceId, setTraceId] = useState<string | null>(null)
  const [trace, setTrace] = useState<PromptTrace | null>(null)
  const [debugPanelOpen, setDebugPanelOpen] = useState(false)
  // Note: Client-side check - we'll rely on server returning traceId only in dev
  const [isDevMode] = useState(typeof window !== 'undefined' && window.location.hostname !== 'app.signpostingtool.co.uk')

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setErrorDetails(null)

    try {
      const response = await fetch('/api/editorial/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surgeryId,
          promptText,
          targetRole,
          count,
          tags: tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          interactiveFirst,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (payload?.errorCode === 'SCHEMA_MISMATCH') {
          setError('Generation failed: schema mismatch')
          const traceIdFromError = payload.traceId
          setErrorDetails({
            requestId: payload.requestId,
            traceId: traceIdFromError,
            issues: Array.isArray(payload.issues) ? payload.issues : [],
            rawSnippet: payload.rawSnippet,
          })
          // Auto-open debug panel on schema mismatch
          if (traceIdFromError && isDevMode) {
            setTraceId(traceIdFromError)
            setDebugPanelOpen(true)
            fetchTrace(traceIdFromError)
          }
          return
        }
        
        // Handle safety validation failures
        if (payload?.error?.code === 'SAFETY_VALIDATION_FAILED') {
          setError('Admin output failed safety validation')
          const traceIdFromError = payload.traceId
          setErrorDetails({
            requestId: payload.requestId,
            traceId: traceIdFromError,
            issues: Array.isArray(payload.error?.details) ? payload.error.details : [],
          })
          // Auto-open debug panel on safety validation failure
          if (traceIdFromError && isDevMode) {
            setTraceId(traceIdFromError)
            setDebugPanelOpen(true)
            fetchTrace(traceIdFromError)
          }
          return
        }
        
        throw new Error(payload?.error?.message || 'Unable to generate drafts')
      }

      // Store traceId and fetch trace in dev mode
      if (payload.traceId && isDevMode) {
        setTraceId(payload.traceId)
        fetchTrace(payload.traceId)
      }

      router.push(`/editorial/batches/${payload.batchId}?surgery=${surgeryId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setPromptText('')
    setTags('')
    setCount(5)
    setTargetRole('ADMIN')
    setInteractiveFirst(true)
    setError(null)
    setErrorDetails(null)
    setTraceId(null)
    setTrace(null)
    setDebugPanelOpen(false)
  }

  const fetchTrace = async (id: string) => {
    try {
      const response = await fetch(`/api/editorial/prompt-trace?traceId=${id}`)
      if (response.ok) {
        const data = await response.json()
        setTrace(data)
      }
    } catch (err) {
      console.error('Failed to fetch trace:', err)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const formatJson = (obj: unknown) => {
    return JSON.stringify(obj, null, 2)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-nhs-dark-blue">Editorial generator</h1>
        <p className="mt-2 text-sm text-slate-600">
          Draft Daily Dose cards with an AI prompt. Review and approve before publishing.
        </p>
        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
            {errorDetails && (
              <details className="mt-3 text-xs text-red-800">
                <summary className="cursor-pointer">Details (editors/admin only)</summary>
                {errorDetails.requestId && (
                  <div className="mt-2">
                    Request ID: <span className="font-mono">{errorDetails.requestId}</span>
                  </div>
                )}
                {errorDetails.issues.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {errorDetails.issues.map((issue, index) => (
                      <li key={`${issue.path}-${index}`}>
                        <span className="font-semibold">{issue.path}:</span> {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
                {errorDetails.rawSnippet && (
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-red-100 p-2 text-[11px] text-red-900">
                    {errorDetails.rawSnippet}
                  </pre>
                )}
              </details>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleGenerate} className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <label className="block text-sm">
            Prompt
            <textarea
              rows={4}
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder='e.g. "Create 5 learning cards for the admin team about mental health crises"'
              required
            />
          </label>

          <div className="space-y-4">
            <label className="block text-sm">
              Target role
              <select
                value={targetRole}
                onChange={(event) => setTargetRole(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="ADMIN">Admin / Reception</option>
                <option value="GP">GP / Prescriber</option>
                <option value="NURSE">Nurse / HCA</option>
              </select>
            </label>

            <label className="block text-sm">
              Number of cards
              <input
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm">
              Tags (optional)
              <input
                type="text"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="e.g. mental health, escalation"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={interactiveFirst}
                onChange={(event) => setInteractiveFirst(event.target.checked)}
                className="accent-nhs-blue"
              />
              Interactive-first (default on)
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Generating…' : 'Generate drafts'}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-nhs-blue"
          >
            Clear
          </button>
        </div>
      </form>

      {/* Debug Panel (dev/preview only) */}
      {isDevMode && (
        <details
          open={debugPanelOpen}
          className="rounded-lg border border-slate-200 bg-white"
        >
          <summary className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Debug Panel {traceId && <span className="font-mono text-xs text-slate-500">(Trace ID: {traceId})</span>}
          </summary>
          <div className="border-t border-slate-200 p-6 space-y-4">
            {!trace && traceId && (
              <div className="text-sm text-slate-600">Loading trace data...</div>
            )}
            {!traceId && (
              <div className="text-sm text-slate-500">Generate cards to see debug information</div>
            )}
            {trace && (
              <>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Toolkit Injected:</strong> {trace.toolkitInjected ? 'Yes' : 'No'}
                  </div>
                  <div>
                    <strong>Matched Symptoms:</strong>{' '}
                    {trace.matchedSymptoms.length > 0 ? trace.matchedSymptoms.join(', ') : 'None'}
                  </div>
                  <div>
                    <strong>Context Length:</strong> {trace.toolkitContextLength.toLocaleString()} chars
                  </div>
                  <div>
                    <strong>Created At:</strong> {new Date(trace.createdAt).toLocaleString()}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-sm">System Prompt</strong>
                      <button
                        onClick={() => copyToClipboard(trace.promptSystem)}
                        className="text-xs text-nhs-blue hover:underline"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="text-xs bg-slate-50 p-3 rounded border overflow-auto max-h-64 whitespace-pre-wrap">
                      {trace.promptSystem}
                    </pre>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-sm">User Prompt</strong>
                      <button
                        onClick={() => copyToClipboard(trace.promptUser)}
                        className="text-xs text-nhs-blue hover:underline"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="text-xs bg-slate-50 p-3 rounded border overflow-auto max-h-96 whitespace-pre-wrap">
                      {trace.promptUser}
                    </pre>
                  </div>

                  {trace.modelRawJson && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-sm">Raw Model Output (JSON)</strong>
                        <button
                          onClick={() => copyToClipboard(formatJson(trace.modelRawJson))}
                          className="text-xs text-nhs-blue hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="text-xs bg-slate-50 p-3 rounded border overflow-auto max-h-96">
                        {formatJson(trace.modelRawJson)}
                      </pre>
                    </div>
                  )}

                  {trace.modelNormalisedJson && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-sm">Normalised Output</strong>
                        <button
                          onClick={() => copyToClipboard(formatJson(trace.modelNormalisedJson))}
                          className="text-xs text-nhs-blue hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="text-xs bg-slate-50 p-3 rounded border overflow-auto max-h-96">
                        {formatJson(trace.modelNormalisedJson)}
                      </pre>
                    </div>
                  )}

                  {trace.validationErrors && (
                    <div>
                      <strong className="text-sm text-red-700">Schema Validation Errors</strong>
                      <pre className="text-xs bg-red-50 p-3 rounded border overflow-auto max-h-64 mt-2">
                        {formatJson(trace.validationErrors)}
                      </pre>
                    </div>
                  )}

                  {trace.safetyValidationErrors && trace.safetyValidationErrors.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-sm text-red-700">
                          Safety Validation Errors{' '}
                          {trace.safetyValidationPassed === false && (
                            <span className="font-normal text-red-600">(Failed)</span>
                          )}
                        </strong>
                        <button
                          onClick={() => copyToClipboard(formatJson(trace.safetyValidationErrors))}
                          className="text-xs text-nhs-blue hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="space-y-2">
                        {trace.safetyValidationErrors.map((error, index) => (
                          <div key={index} className="bg-red-50 p-3 rounded border border-red-200">
                            <div className="font-semibold text-sm text-red-900">
                              {error.code}
                              {error.cardTitle && <span className="font-normal text-red-700"> - {error.cardTitle}</span>}
                            </div>
                            <div className="text-xs text-red-700 mt-1">{error.message}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {trace.safetyValidationPassed === true && (
                    <div className="bg-green-50 p-3 rounded border border-green-200">
                      <strong className="text-sm text-green-900">Safety Validation: Passed ✓</strong>
                    </div>
                  )}

                  {trace.sources && (
                    <div>
                      <strong className="text-sm">Sources</strong>
                      <pre className="text-xs bg-slate-50 p-3 rounded border overflow-auto max-h-64 mt-2">
                        {formatJson(trace.sources)}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </details>
      )}
    </div>
  )
}
