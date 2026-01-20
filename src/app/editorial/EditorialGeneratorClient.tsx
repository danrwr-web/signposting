'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface EditorialGeneratorClientProps {
  surgeryId: string
}

// Debug info returned inline from the generate API (no separate fetch needed)
interface DebugInfo {
  stage?: string
  requestId?: string
  surgeryId?: string
  targetRole?: string
  promptText?: string
  traceId?: string
  toolkitInjected?: boolean
  toolkitSource?: { title: string; url: string | null; publisher?: string } | null
  matchedSymptoms?: string[]
  toolkitContextLength?: number
  promptSystem?: string
  promptUser?: string
  modelRawText?: string
  modelRawJson?: unknown
  modelNormalisedJson?: unknown
  schemaErrors?: Array<{ path: string; message: string }>
  safetyErrors?: Array<{ code: string; message: string; cardTitle?: string }>
  error?: { name?: string; message?: string; stack?: string }
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
    issues: Array<{ path?: string; code?: string; message: string }>
    rawSnippet?: string
  } | null>(null)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [debugPanelOpen, setDebugPanelOpen] = useState(false)
  // Use effect to avoid hydration mismatch - start false on server, update on client
  const [isDevMode, setIsDevMode] = useState(false)
  
  useEffect(() => {
    // Only check on client side after mount
    setIsDevMode(typeof window !== 'undefined' && window.location.hostname !== 'app.signpostingtool.co.uk')
  }, [])

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setErrorDetails(null)
    setDebugInfo(null)

    try {
      // Debug is automatic for editors/admins in non-production (no query param needed)
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

      const payload = await response.json().catch(() => ({ ok: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse response' } }))
      
      // Capture inline debug info if available (automatic for editors/admins in non-production)
      // Always capture on any response (success or failure)
      if (payload?.debug) {
        setDebugInfo(payload.debug as DebugInfo)
      }
      
      // Handle any error response (ok: false or !response.ok)
      if (!response.ok || payload?.ok === false) {
        const errorCode = payload?.error?.code || payload?.errorCode || 'UNKNOWN_ERROR'
        const errorMessage = payload?.error?.message || payload?.error?.message || 'Unable to generate drafts'
        
        setError(errorMessage)
        setErrorDetails({
          requestId: payload?.requestId || payload?.debug?.requestId,
          traceId: payload?.traceId || payload?.debug?.traceId,
          issues: Array.isArray(payload?.error?.details) 
            ? payload.error.details 
            : Array.isArray(payload?.issues) 
              ? payload.issues 
              : [],
          rawSnippet: payload?.rawSnippet,
        })
        
        // Auto-open debug panel on any error
        setDebugPanelOpen(true)
        return
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
    setDebugInfo(null)
    setDebugPanelOpen(false)
  }

  const formatJson = (obj: unknown): string => {
    try {
      if (obj === null || obj === undefined) return ''
      if (typeof obj === 'string') return obj
      return JSON.stringify(obj, null, 2)
    } catch {
      return String(obj ?? '')
    }
  }

  const safeString = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'object') return formatJson(value)
    return String(value)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-nhs-dark-blue">Editorial generator</h1>
            <p className="mt-2 text-sm text-slate-600">
              Draft Daily Dose cards with an AI prompt. Review and approve before publishing.
            </p>
          </div>
          <Link
            href={`/editorial/library?surgery=${surgeryId}`}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-nhs-blue hover:bg-nhs-light-blue"
          >
            View Library →
          </Link>
        </div>
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
                      <li key={`${issue.path ?? issue.code ?? ''}-${index}`}>
                        {(issue.path ?? issue.code) && (
                          <span className="font-semibold">{issue.path ?? issue.code}: </span>
                        )}
                        {issue.message}
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

      {/* Debug Panel (automatic for editors/admins in non-production) */}
      {isDevMode && (
        <details
          open={debugPanelOpen}
          className="rounded-lg border border-slate-200 bg-white"
        >
          <summary className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Debug Panel{' '}
            {debugInfo?.traceId && (
              <span className="font-mono text-xs text-slate-500">
                ({debugInfo.stage || 'ready'} • Trace: {debugInfo.traceId.slice(0, 8)}…)
              </span>
            )}
          </summary>
          <div className="border-t border-slate-200 p-6 space-y-4">
            {!debugInfo && (
              <div className="text-sm text-slate-500">No debug data yet. Generate cards to see debug information.</div>
            )}
            {debugInfo && (
              <>
                {/* Debug Summary Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-slate-50 p-3 rounded border">
                  <div>
                    <strong>Stage:</strong> {safeString(debugInfo.stage || 'unknown')}
                  </div>
                  <div>
                    <strong>Toolkit:</strong> {debugInfo.toolkitInjected ? '✓ Injected' : '✗ None'}
                  </div>
                  <div>
                    <strong>Symptoms:</strong>{' '}
                    {Array.isArray(debugInfo.matchedSymptoms) && debugInfo.matchedSymptoms.length > 0
                      ? debugInfo.matchedSymptoms.join(', ')
                      : 'None'}
                  </div>
                  <div>
                    <strong>Context:</strong>{' '}
                    {typeof debugInfo.toolkitContextLength === 'number'
                      ? debugInfo.toolkitContextLength.toLocaleString()
                      : '0'}{' '}
                    chars
                  </div>
                </div>

                <div className="space-y-4">
                  {/* System Prompt */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-sm">System Prompt</strong>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(debugInfo.promptSystem)}
                        className="text-xs text-nhs-blue hover:underline"
                      >
                        Copy
                      </button>
                    </div>
                    <pre className="text-xs bg-slate-50 p-3 rounded border overflow-auto max-h-64 whitespace-pre-wrap break-words">
                      {safeString(debugInfo.promptSystem)}
                    </pre>
                  </div>

                  {/* User Prompt */}
                  {debugInfo.promptUser && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-sm">User Prompt</strong>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(safeString(debugInfo.promptUser))}
                          className="text-xs text-nhs-blue hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="text-xs bg-slate-50 p-3 rounded border overflow-auto max-h-96 whitespace-pre-wrap break-words">
                        {safeString(debugInfo.promptUser)}
                      </pre>
                    </div>
                  )}

                  {/* Model Raw Text */}
                  {debugInfo.modelRawText && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-sm">Raw Model Output (Text)</strong>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(safeString(debugInfo.modelRawText))}
                          className="text-xs text-nhs-blue hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="text-xs bg-slate-50 p-3 rounded border overflow-auto max-h-96 whitespace-pre-wrap break-words">
                        {safeString(debugInfo.modelRawText)}
                      </pre>
                    </div>
                  )}

                  {/* Model Raw JSON */}
                  {debugInfo.modelRawJson !== undefined && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-sm">Raw Model Output (JSON)</strong>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formatJson(debugInfo.modelRawJson))}
                          className="text-xs text-nhs-blue hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="text-xs bg-slate-50 p-3 rounded border overflow-auto max-h-96 whitespace-pre-wrap break-words">
                        {formatJson(debugInfo.modelRawJson)}
                      </pre>
                    </div>
                  )}

                  {/* Normalised Output */}
                  {debugInfo.modelNormalisedJson !== undefined && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-sm">Normalised Output</strong>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formatJson(debugInfo.modelNormalisedJson))}
                          className="text-xs text-nhs-blue hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="text-xs bg-slate-50 p-3 rounded border overflow-auto max-h-96 whitespace-pre-wrap break-words">
                        {formatJson(debugInfo.modelNormalisedJson)}
                      </pre>
                    </div>
                  )}

                  {/* Schema Validation Errors */}
                  {debugInfo.schemaErrors && debugInfo.schemaErrors.length > 0 && (
                    <div>
                      <strong className="text-sm text-red-700">Schema Validation Errors</strong>
                      <div className="space-y-2 mt-2">
                        {debugInfo.schemaErrors.map((err, index) => (
                          <div key={index} className="bg-red-50 p-3 rounded border border-red-200">
                            <div className="font-semibold text-sm text-red-900">{err.path}</div>
                            <div className="text-xs text-red-700 mt-1">{err.message}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Safety Validation Errors */}
                  {Array.isArray(debugInfo.safetyErrors) && debugInfo.safetyErrors.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <strong className="text-sm text-red-700">Safety Validation Errors (Failed)</strong>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(formatJson(debugInfo.safetyErrors))}
                          className="text-xs text-nhs-blue hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="space-y-2">
                        {debugInfo.safetyErrors.map((err, index) => {
                          const code = safeString(err?.code || err || 'UNKNOWN')
                          const message = safeString(err?.message || '')
                          const cardTitle = err?.cardTitle ? safeString(err.cardTitle) : null
                          return (
                            <div key={index} className="bg-red-50 p-3 rounded border border-red-200">
                              <div className="font-semibold text-sm text-red-900">
                                {code}
                                {cardTitle && <span className="font-normal text-red-700"> – {cardTitle}</span>}
                              </div>
                              {message && <div className="text-xs text-red-700 mt-1">{message}</div>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Error Object */}
                  {debugInfo.error && (
                    <div>
                      <strong className="text-sm text-red-700">Error Details</strong>
                      <pre className="text-xs bg-red-50 p-3 rounded border overflow-auto max-h-64 mt-2 whitespace-pre-wrap break-words">
                        {formatJson(debugInfo.error)}
                      </pre>
                    </div>
                  )}

                  {/* Toolkit Source */}
                  {debugInfo.toolkitSource && (
                    <div>
                      <strong className="text-sm">Toolkit Source</strong>
                      <pre className="text-xs bg-slate-50 p-3 rounded border overflow-auto max-h-64 mt-2 whitespace-pre-wrap break-words">
                        {formatJson(debugInfo.toolkitSource)}
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
