'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface EditorialGeneratorClientProps {
  surgeryId: string
  isSuperuser?: boolean
}

// Generation insights info returned inline from the generate API
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
  fallbackUsed?: boolean
  fallbackReason?: string | null
  totalSymptomsSearched?: number
  toolkitContextSnippet?: string | null
  promptSystem?: string
  promptUser?: string
  modelRawText?: string
  modelRawJson?: unknown
  modelNormalisedJson?: unknown
  schemaErrors?: Array<{ path: string; message: string }>
  safetyErrors?: Array<{ code: string; message: string; cardTitle?: string }>
  error?: { name?: string; message?: string; stack?: string }
}

// Toolkit metadata returned by the preview endpoint
interface ToolkitMeta {
  toolkitInjected: boolean
  matchedSymptoms: string[]
  toolkitContextLength: number
  fallbackUsed: boolean
  fallbackReason: string | null
  totalSymptomsSearched: number
  toolkitContextSnippet: string | null
  toolkitSource: { title: string; url: string | null; publisher: string } | null
}

// Preview response from the server
interface PromptPreview {
  systemPrompt: string
  userPrompt: string
  toolkitMeta: ToolkitMeta
  resolvedRole: string
}

export default function EditorialGeneratorClient({ surgeryId, isSuperuser = false }: EditorialGeneratorClientProps) {
  const router = useRouter()
  const [promptText, setPromptText] = useState('')
  const [targetRole, setTargetRole] = useState('ADMIN')
  const [count, setCount] = useState(5)
  const [interactiveFirst, setInteractiveFirst] = useState(true)
  const [loading, setLoading] = useState(false)
  const [generateInBackground, setGenerateInBackground] = useState(false)
  const [overrideValidation, setOverrideValidation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<{
    requestId?: string
    traceId?: string
    errorCode?: string
    issues: Array<{ path?: string; code?: string; message: string }>
    rawSnippet?: string
  } | null>(null)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [debugPanelOpen, setDebugPanelOpen] = useState(false)
  // Superusers always see insights; other admins only in non-production
  const [isDevMode, setIsDevMode] = useState(false)

  // Prompt preview state (superuser only)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewData, setPreviewData] = useState<PromptPreview | null>(null)
  const [editedSystemPrompt, setEditedSystemPrompt] = useState('')
  const [editedUserPrompt, setEditedUserPrompt] = useState('')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewPanelRef = useRef<HTMLDivElement>(null)

  // Track whether the superuser has modified either prompt from the original
  const systemPromptModified = previewData !== null && editedSystemPrompt !== previewData.systemPrompt
  const userPromptModified = previewData !== null && editedUserPrompt !== previewData.userPrompt
  const anyPromptModified = systemPromptModified || userPromptModified
  const showInsightsPanel = isSuperuser || isDevMode
  
  useEffect(() => {
    // Only check on client side after mount
    setIsDevMode(typeof window !== 'undefined' && window.location.hostname !== 'app.signpostingtool.co.uk')
  }, [])

  const handlePreviewPrompt = async () => {
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewData(null)

    try {
      const response = await fetch('/api/editorial/generate/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surgeryId,
          promptText,
          targetRole,
          count,
          interactiveFirst,
        }),
      })

      const payload = await response.json().catch(() => ({
        ok: false,
        error: { message: 'Failed to parse response' },
      }))

      if (!response.ok || payload?.ok === false) {
        setPreviewError(payload?.error?.message || 'Unable to preview prompts')
        return
      }

      const preview: PromptPreview = {
        systemPrompt: payload.systemPrompt,
        userPrompt: payload.userPrompt,
        toolkitMeta: payload.toolkitMeta,
        resolvedRole: payload.resolvedRole,
      }
      setPreviewData(preview)
      setEditedSystemPrompt(preview.systemPrompt)
      setEditedUserPrompt(preview.userPrompt)

      // Scroll to the preview panel after it renders
      requestAnimationFrame(() => {
        previewPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleDiscardPreview = () => {
    setPreviewData(null)
    setEditedSystemPrompt('')
    setEditedUserPrompt('')
    setPreviewError(null)
  }

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setErrorDetails(null)
    setDebugInfo(null)

    // Build the base request body
    const requestBody: Record<string, unknown> = {
      surgeryId,
      promptText,
      targetRole,
      count,
      interactiveFirst,
      ...(isSuperuser ? { overrideValidation } : {}),
    }

    // If superuser has previewed (and possibly edited) prompts, include overrides
    if (isSuperuser && previewData) {
      requestBody.systemPromptOverride = editedSystemPrompt
      requestBody.userPromptOverride = editedUserPrompt
    }

    try {
      if (generateInBackground) {
        const response = await fetch('/api/editorial/generate/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
        const payload = await response.json().catch(() => ({ ok: false, error: { message: 'Failed to parse response' } }))
        if (!response.ok || payload?.ok === false) {
          setError(payload?.error?.message || 'Unable to start generation')
          return
        }
        router.push(`/editorial/library?surgery=${surgeryId}&jobId=${payload.jobId}`)
        return
      }

      const response = await fetch('/api/editorial/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const payload = await response.json().catch(() => ({ ok: false, error: { code: 'PARSE_ERROR', message: 'Failed to parse response' } }))
      
      if (payload?.debug) {
        setDebugInfo(payload.debug as DebugInfo)
      }
      
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
    setCount(5)
    setTargetRole('ADMIN')
    setInteractiveFirst(true)
    setOverrideValidation(false)
    setError(null)
    setErrorDetails(null)
    setDebugInfo(null)
    setDebugPanelOpen(false)
    // Reset preview state
    setPreviewData(null)
    setEditedSystemPrompt('')
    setEditedUserPrompt('')
    setPreviewError(null)
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
            {isSuperuser &&
              errorDetails?.errorCode === 'SAFETY_VALIDATION_FAILED' &&
              !overrideValidation && (
                <p className="mt-2 text-amber-800">
                  To save anyway, enable &quot;Allow validation override&quot; and generate again.
                </p>
              )}
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

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={interactiveFirst}
                onChange={(event) => setInteractiveFirst(event.target.checked)}
                className="accent-nhs-blue"
              />
              Interactive-first (default on)
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={generateInBackground}
                onChange={(event) => setGenerateInBackground(event.target.checked)}
                className="accent-nhs-blue"
              />
              Run in background (continue reviewing cards while generating; you will be notified when ready)
            </label>

            {isSuperuser && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={overrideValidation}
                  onChange={(event) => setOverrideValidation(event.target.checked)}
                  className="accent-nhs-blue"
                />
                Allow validation override (save cards even if safety checks fail)
              </label>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading || previewLoading}
            className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Generating…' : 'Generate drafts'}
          </button>
          {isSuperuser && (
            <button
              type="button"
              disabled={loading || previewLoading || !promptText}
              onClick={handlePreviewPrompt}
              className="rounded-md border border-nhs-blue px-4 py-2 text-sm font-semibold text-nhs-blue hover:bg-nhs-light-blue disabled:cursor-not-allowed disabled:opacity-70"
            >
              {previewLoading ? 'Building prompts…' : 'Preview prompt'}
            </button>
          )}
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-nhs-blue"
          >
            Clear
          </button>
        </div>
      </form>

      {/* Prompt Preview Panel (superuser only) */}
      {isSuperuser && previewError && !previewData && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {previewError}
        </div>
      )}
      {isSuperuser && previewData && (
        <div
          ref={previewPanelRef}
          className="rounded-lg border-2 border-nhs-blue bg-white"
          role="region"
          aria-label="Prompt preview and editing"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-nhs-dark-blue">Prompt preview</h2>
              <p className="mt-1 text-xs text-slate-500">
                Review and optionally edit the prompts before sending to the AI.
                {anyPromptModified && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Modified
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Role: <strong>{previewData.resolvedRole}</strong></span>
            </div>
          </div>

          {/* Toolkit metadata summary */}
          <div className="border-b border-slate-200 px-6 py-3">
            <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
              <div>
                <strong className="text-slate-600">Toolkit advice:</strong>{' '}
                {previewData.toolkitMeta.toolkitInjected
                  ? previewData.toolkitMeta.fallbackUsed
                    ? 'Fallback (static)'
                    : 'Matched from surgery'
                  : 'Not injected'}
              </div>
              <div>
                <strong className="text-slate-600">Matched symptoms:</strong>{' '}
                {previewData.toolkitMeta.matchedSymptoms.length > 0
                  ? previewData.toolkitMeta.matchedSymptoms.join(', ')
                  : 'None'}
              </div>
              <div>
                <strong className="text-slate-600">Toolkit context:</strong>{' '}
                {previewData.toolkitMeta.toolkitContextLength.toLocaleString()} chars
              </div>
              <div>
                <strong className="text-slate-600">Symptoms searched:</strong>{' '}
                {previewData.toolkitMeta.totalSymptomsSearched}
              </div>
            </div>
            {previewData.toolkitMeta.fallbackUsed && previewData.toolkitMeta.fallbackReason && (
              <p className="mt-2 text-xs text-amber-700">
                <strong>Fallback reason:</strong> {previewData.toolkitMeta.fallbackReason}
              </p>
            )}
          </div>

          {/* Editable prompts */}
          <div className="space-y-4 px-6 py-4">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="preview-system-prompt" className="text-sm font-semibold text-slate-700">
                  System prompt
                  {systemPromptModified && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Edited
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  {systemPromptModified && (
                    <button
                      type="button"
                      onClick={() => setEditedSystemPrompt(previewData.systemPrompt)}
                      className="text-xs text-slate-500 hover:text-nhs-blue hover:underline"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => copyToClipboard(editedSystemPrompt)}
                    className="text-xs text-nhs-blue hover:underline"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <textarea
                id="preview-system-prompt"
                rows={10}
                value={editedSystemPrompt}
                onChange={(e) => setEditedSystemPrompt(e.target.value)}
                className={`w-full rounded-md border px-3 py-2 font-mono text-xs ${
                  systemPromptModified
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
                aria-describedby="system-prompt-hint"
              />
              <p id="system-prompt-hint" className="mt-1 text-xs text-slate-400">
                Controls the AI&apos;s role, rules, and output format.
              </p>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="preview-user-prompt" className="text-sm font-semibold text-slate-700">
                  User prompt (includes toolkit context)
                  {userPromptModified && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Edited
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  {userPromptModified && (
                    <button
                      type="button"
                      onClick={() => setEditedUserPrompt(previewData.userPrompt)}
                      className="text-xs text-slate-500 hover:text-nhs-blue hover:underline"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => copyToClipboard(editedUserPrompt)}
                    className="text-xs text-nhs-blue hover:underline"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <textarea
                id="preview-user-prompt"
                rows={16}
                value={editedUserPrompt}
                onChange={(e) => setEditedUserPrompt(e.target.value)}
                className={`w-full rounded-md border px-3 py-2 font-mono text-xs ${
                  userPromptModified
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
                aria-describedby="user-prompt-hint"
              />
              <p id="user-prompt-hint" className="mt-1 text-xs text-slate-400">
                The full prompt sent to the AI, including toolkit guidance, card count, tags, and JSON schema.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              disabled={loading}
              onClick={(e) => handleGenerate(e as unknown as React.FormEvent)}
              className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Generating…' : anyPromptModified ? 'Generate with edited prompts' : 'Generate with these prompts'}
            </button>
            <button
              type="button"
              onClick={handleDiscardPreview}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-nhs-blue"
            >
              Discard
            </button>
            {anyPromptModified && (
              <span className="text-xs text-amber-700" role="status">
                One or both prompts have been edited from the original.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Generation Insights (superusers always; other admins in non-production only) */}
      {showInsightsPanel && (
        <details
          open={debugPanelOpen}
          className="rounded-lg border border-slate-200 bg-white"
        >
          <summary className="cursor-pointer px-6 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Generation Insights{' '}
            {debugInfo?.traceId && (
              <span className="font-mono text-xs text-slate-500">
                ({debugInfo.stage || 'ready'} &bull; Trace: {debugInfo.traceId.slice(0, 8)}&hellip;)
              </span>
            )}
          </summary>
          <div className="border-t border-slate-200 p-6 space-y-4">
            {!debugInfo && (
              <div className="text-sm text-slate-500">No insights data yet. Generate cards to see what happened under the hood.</div>
            )}
            {debugInfo && (
              <>
                {/* Summary Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-slate-50 p-3 rounded border">
                  <div>
                    <strong>Stage:</strong> {safeString(debugInfo.stage || 'unknown')}
                  </div>
                  <div>
                    <strong>Toolkit advice:</strong>{' '}
                    {debugInfo.toolkitInjected
                      ? debugInfo.fallbackUsed
                        ? 'Fallback (static)'
                        : 'Matched from surgery'
                      : 'Not injected'}
                  </div>
                  <div>
                    <strong>Matched symptoms:</strong>{' '}
                    {Array.isArray(debugInfo.matchedSymptoms) && debugInfo.matchedSymptoms.length > 0
                      ? debugInfo.matchedSymptoms.join(', ')
                      : 'None'}
                  </div>
                  <div>
                    <strong>Toolkit context:</strong>{' '}
                    {typeof debugInfo.toolkitContextLength === 'number'
                      ? debugInfo.toolkitContextLength.toLocaleString()
                      : '0'}{' '}
                    chars
                  </div>
                </div>

                {/* Toolkit matching detail row */}
                {debugInfo.toolkitInjected && (
                  <div className="text-sm bg-blue-50 p-3 rounded border border-blue-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <strong>Symptoms searched:</strong>{' '}
                      {typeof debugInfo.totalSymptomsSearched === 'number'
                        ? debugInfo.totalSymptomsSearched
                        : 'unknown'}
                    </div>
                    {debugInfo.fallbackUsed && debugInfo.fallbackReason && (
                      <div className="text-amber-800">
                        <strong>Fallback reason:</strong> {debugInfo.fallbackReason}
                      </div>
                    )}
                    {!debugInfo.fallbackUsed && debugInfo.matchedSymptoms && debugInfo.matchedSymptoms.length > 0 && (
                      <div className="text-green-800">
                        <strong>Surgery-specific advice injected for:</strong>{' '}
                        {debugInfo.matchedSymptoms.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {/* Toolkit Context Snippet */}
                {debugInfo.toolkitContextSnippet && (
                  <details className="text-sm">
                    <summary className="cursor-pointer font-semibold text-slate-700 hover:text-nhs-blue">
                      Toolkit context sent to AI (preview)
                    </summary>
                    <pre className="mt-2 text-xs bg-slate-50 p-3 rounded border overflow-auto max-h-64 whitespace-pre-wrap break-words">
                      {safeString(debugInfo.toolkitContextSnippet)}
                    </pre>
                  </details>
                )}

                <div className="space-y-4">
                  {/* System Prompt */}
                  <details className="text-sm">
                    <summary className="cursor-pointer font-semibold text-slate-700 hover:text-nhs-blue">
                      System prompt sent to AI
                    </summary>
                    <div className="mt-2">
                      <div className="flex items-center justify-end mb-1">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(safeString(debugInfo.promptSystem))}
                          className="text-xs text-nhs-blue hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="text-xs bg-slate-50 p-3 rounded border overflow-auto max-h-64 whitespace-pre-wrap break-words">
                        {safeString(debugInfo.promptSystem)}
                      </pre>
                    </div>
                  </details>

                  {/* User Prompt */}
                  {debugInfo.promptUser && (
                    <details className="text-sm">
                      <summary className="cursor-pointer font-semibold text-slate-700 hover:text-nhs-blue">
                        User prompt sent to AI (includes toolkit context)
                      </summary>
                      <div className="mt-2">
                        <div className="flex items-center justify-end mb-1">
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
                    </details>
                  )}

                  {/* Model Raw Text */}
                  {debugInfo.modelRawText && (
                    <details className="text-sm">
                      <summary className="cursor-pointer font-semibold text-slate-700 hover:text-nhs-blue">
                        Raw model output (text)
                      </summary>
                      <div className="mt-2">
                        <div className="flex items-center justify-end mb-1">
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
                    </details>
                  )}

                  {/* Model Raw JSON */}
                  {debugInfo.modelRawJson !== undefined && (
                    <details className="text-sm">
                      <summary className="cursor-pointer font-semibold text-slate-700 hover:text-nhs-blue">
                        Raw model output (JSON)
                      </summary>
                      <div className="mt-2">
                        <div className="flex items-center justify-end mb-1">
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
                    </details>
                  )}

                  {/* Normalised Output */}
                  {debugInfo.modelNormalisedJson !== undefined && (
                    <details className="text-sm">
                      <summary className="cursor-pointer font-semibold text-slate-700 hover:text-nhs-blue">
                        Normalised output
                      </summary>
                      <div className="mt-2">
                        <div className="flex items-center justify-end mb-1">
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
                    </details>
                  )}

                  {/* Schema Validation Errors */}
                  {debugInfo.schemaErrors && debugInfo.schemaErrors.length > 0 && (
                    <div>
                      <strong className="text-sm text-red-700">Schema validation errors</strong>
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
                        <strong className="text-sm text-red-700">Safety validation errors</strong>
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
                                {cardTitle && <span className="font-normal text-red-700"> &ndash; {cardTitle}</span>}
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
                      <strong className="text-sm text-red-700">Error details</strong>
                      <pre className="text-xs bg-red-50 p-3 rounded border overflow-auto max-h-64 mt-2 whitespace-pre-wrap break-words">
                        {formatJson(debugInfo.error)}
                      </pre>
                    </div>
                  )}

                  {/* Toolkit Source */}
                  {debugInfo.toolkitSource && (
                    <div>
                      <strong className="text-sm">Toolkit source</strong>
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
