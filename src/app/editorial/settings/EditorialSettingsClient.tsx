'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const ROLES = ['ADMIN', 'GP', 'NURSE'] as const
type Role = (typeof ROLES)[number]

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin / Reception',
  GP: 'GP / Prescriber',
  NURSE: 'Nurse / HCA',
}

interface RoleTemplate {
  role: Role
  template: string
  defaultTemplate: string
  isCustom: boolean
  updatedAt: string | null
  updatedBy: string | null
}

export default function EditorialSettingsClient() {
  const [templates, setTemplates] = useState<RoleTemplate[]>([])
  const [activeRole, setActiveRole] = useState<Role>('ADMIN')
  const [editedTemplate, setEditedTemplate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const activeTemplate = templates.find((t) => t.role === activeRole)
  const isModified = activeTemplate ? editedTemplate !== activeTemplate.template : false
  const isCustom = activeTemplate?.isCustom ?? false

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/editorial/settings/prompt-templates')
      const payload = await response.json().catch(() => ({
        ok: false,
        error: { message: 'Failed to parse response' },
      }))
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message || 'Failed to load templates')
        return
      }
      const fetched = payload.templates as RoleTemplate[]
      setTemplates(fetched)
      // Set the editor to the active role's template
      const active = fetched.find((t) => t.role === activeRole)
      if (active) {
        setEditedTemplate(active.template)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [activeRole])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // When switching tabs, load the template for that role
  const handleTabChange = (role: Role) => {
    setActiveRole(role)
    const t = templates.find((tpl) => tpl.role === role)
    if (t) {
      setEditedTemplate(t.template)
    }
    setSuccessMessage(null)
    setError(null)
    setShowResetConfirm(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const response = await fetch('/api/editorial/settings/prompt-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: activeRole, template: editedTemplate }),
      })
      const payload = await response.json().catch(() => ({
        ok: false,
        error: { message: 'Failed to parse response' },
      }))
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message || 'Failed to save template')
        return
      }
      setSuccessMessage(`${ROLE_LABELS[activeRole]} template saved successfully.`)
      // Refresh templates from server
      await fetchTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    setError(null)
    setSuccessMessage(null)
    setShowResetConfirm(false)
    try {
      const response = await fetch('/api/editorial/settings/prompt-templates/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: activeRole }),
      })
      const payload = await response.json().catch(() => ({
        ok: false,
        error: { message: 'Failed to parse response' },
      }))
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message || 'Failed to reset template')
        return
      }
      setSuccessMessage(`${ROLE_LABELS[activeRole]} template reset to default.`)
      // Refresh templates from server
      await fetchTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setResetting(false)
    }
  }

  const handleRevertEdits = () => {
    if (activeTemplate) {
      setEditedTemplate(activeTemplate.template)
    }
    setSuccessMessage(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-nhs-dark-blue">Prompt settings</h1>
            <p className="mt-2 text-sm text-slate-600">
              Customise the system prompt template used when generating Daily Dose cards. Changes apply globally to all surgeries.
            </p>
          </div>
          <Link
            href="/editorial"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-nhs-blue hover:bg-nhs-light-blue"
          >
            ← Back to generator
          </Link>
        </div>
      </div>

      {/* Status messages */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700" role="status">
          {successMessage}
        </div>
      )}

      {/* Main content */}
      <div className="rounded-lg border border-slate-200 bg-white">
        {/* Tab bar */}
        <div className="border-b border-slate-200" role="tablist" aria-label="Role prompt templates">
          <div className="flex">
            {ROLES.map((role) => {
              const isActive = role === activeRole
              const tpl = templates.find((t) => t.role === role)
              return (
                <button
                  key={role}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${role}`}
                  id={`tab-${role}`}
                  onClick={() => handleTabChange(role)}
                  className={`relative px-6 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-b-2 border-nhs-blue text-nhs-blue'
                      : 'text-slate-600 hover:text-nhs-dark-blue'
                  }`}
                >
                  {ROLE_LABELS[role]}
                  {tpl?.isCustom && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      Custom
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab panel */}
        <div
          role="tabpanel"
          id={`tabpanel-${activeRole}`}
          aria-labelledby={`tab-${activeRole}`}
          className="p-6"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500" aria-live="polite">
              Loading templates…
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status badge */}
              <div className="flex items-center gap-3">
                <span
                  role="status"
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    isCustom
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isCustom ? 'Custom template' : 'Default template'}
                </span>
                {isModified && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    Unsaved changes
                  </span>
                )}
                {activeTemplate?.updatedAt && isCustom && (
                  <span className="text-xs text-slate-400">
                    Last saved: {new Date(activeTemplate.updatedAt).toLocaleString('en-GB')}
                  </span>
                )}
              </div>

              {/* Editor */}
              <div>
                <label htmlFor={`template-editor-${activeRole}`} className="sr-only">
                  System prompt template for {ROLE_LABELS[activeRole]}
                </label>
                <textarea
                  id={`template-editor-${activeRole}`}
                  rows={20}
                  value={editedTemplate}
                  onChange={(e) => setEditedTemplate(e.target.value)}
                  className={`w-full rounded-md border px-3 py-2 font-mono text-xs leading-relaxed ${
                    isModified
                      ? 'border-blue-400 bg-blue-50/30'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                  aria-describedby={`template-hint-${activeRole}`}
                />
                <p id={`template-hint-${activeRole}`} className="mt-1 text-xs text-slate-400">
                  This is the system message sent to the AI when generating {ROLE_LABELS[activeRole]} cards.
                  The user prompt (including toolkit context, tags, and JSON schema) is constructed separately.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={saving || !isModified}
                  onClick={handleSave}
                  className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? 'Saving…' : 'Save template'}
                </button>
                {isModified && (
                  <button
                    type="button"
                    onClick={handleRevertEdits}
                    className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-nhs-blue"
                  >
                    Revert changes
                  </button>
                )}
                {isCustom && !showResetConfirm && (
                  <button
                    type="button"
                    disabled={resetting}
                    onClick={() => setShowResetConfirm(true)}
                    className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Reset to default
                  </button>
                )}
                {showResetConfirm && (
                  <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2">
                    <span className="text-xs text-red-700">Discard your custom template?</span>
                    <button
                      type="button"
                      disabled={resetting}
                      onClick={handleReset}
                      className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-70"
                    >
                      {resetting ? 'Resetting…' : 'Yes, reset'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      className="rounded border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-slate-400"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Default template preview (when custom is active) */}
              {isCustom && activeTemplate?.defaultTemplate && (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer font-semibold text-slate-700 hover:text-nhs-blue">
                    View default template for comparison
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                    {activeTemplate.defaultTemplate}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
