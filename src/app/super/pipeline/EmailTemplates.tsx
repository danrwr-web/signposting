'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { Button, Input, Textarea, Badge, AlertBanner } from '@/components/ui'
import {
  DEFAULT_EMAIL_TEMPLATES,
  getDefaultTemplate,
} from './emailTemplateDefaults'

interface Template {
  id: string
  stage: string
  label: string
  subject: string
  body: string
}

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStage, setSelectedStage] = useState<string>(DEFAULT_EMAIL_TEMPLATES[0].stage)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Fetch templates on mount
  useEffect(() => {
    fetch('/api/super/pipeline/email-templates')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTemplates(data)
          // Load first template into editor
          const first = data.find((t: Template) => t.stage === selectedStage)
          if (first) {
            setEditSubject(first.subject)
            setEditBody(first.body)
          }
        }
      })
      .catch(() => toast.error('Failed to load email templates'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function selectStage(stage: string) {
    // Warn if unsaved changes
    if (dirty && !confirm('You have unsaved changes. Discard them?')) return

    setSelectedStage(stage)
    const tpl = templates.find((t) => t.stage === stage)
    if (tpl) {
      setEditSubject(tpl.subject)
      setEditBody(tpl.body)
    }
    setDirty(false)
  }

  const currentTemplate = templates.find((t) => t.stage === selectedStage)
  const defaultTemplate = getDefaultTemplate(selectedStage)
  const isDefault =
    currentTemplate &&
    defaultTemplate &&
    currentTemplate.subject === defaultTemplate.subject &&
    currentTemplate.body === defaultTemplate.body

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/super/pipeline/email-templates/${selectedStage}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: editSubject, body: editBody }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to save')
        return
      }

      const updated = await res.json()
      setTemplates((prev) =>
        prev.map((t) => (t.stage === selectedStage ? updated : t))
      )
      setDirty(false)
      toast.success('Template saved')
    } catch {
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (!defaultTemplate) return
    if (!confirm('Reset this template to the default wording? Your customisations will be lost.')) return

    setSaving(true)
    try {
      const res = await fetch(`/api/super/pipeline/email-templates/${selectedStage}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: defaultTemplate.subject,
          body: defaultTemplate.body,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to reset')
        return
      }

      const updated = await res.json()
      setTemplates((prev) =>
        prev.map((t) => (t.stage === selectedStage ? updated : t))
      )
      setEditSubject(defaultTemplate.subject)
      setEditBody(defaultTemplate.body)
      setDirty(false)
      toast.success('Template reset to default')
    } catch {
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <p className="text-gray-500">Loading templates...</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Stage nav (left) */}
      <div className="lg:col-span-1">
        <nav className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {DEFAULT_EMAIL_TEMPLATES.map((def) => {
            const tpl = templates.find((t) => t.stage === def.stage)
            const isCustomised =
              tpl &&
              (tpl.subject !== def.subject || tpl.body !== def.body)
            return (
              <button
                key={def.stage}
                onClick={() => selectStage(def.stage)}
                className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 last:border-b-0 transition-colors flex items-center justify-between ${
                  selectedStage === def.stage
                    ? 'bg-nhs-blue text-white'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span>{def.label}</span>
                {isCustomised && selectedStage !== def.stage && (
                  <Badge color="purple" size="sm">Edited</Badge>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Editor (right) */}
      <div className="lg:col-span-3 space-y-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-nhs-dark-blue">
              {defaultTemplate?.label}
            </h3>
            <div className="flex items-center gap-2">
              {!isDefault && (
                <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving}>
                  Reset to Default
                </Button>
              )}
              <Button onClick={handleSave} loading={saving} disabled={!dirty}>
                {saving ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </div>

          {dirty && (
            <AlertBanner variant="info" className="mb-4">
              You have unsaved changes.
            </AlertBanner>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-nhs-grey mb-1">
                Subject Line
              </label>
              <Input
                value={editSubject}
                onChange={(e) => {
                  setEditSubject(e.target.value)
                  setDirty(true)
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-nhs-grey mb-1">
                Email Body
              </label>
              <Textarea
                value={editBody}
                onChange={(e) => {
                  setEditBody(e.target.value)
                  setDirty(true)
                }}
                rows={16}
                className="font-mono text-sm"
              />
            </div>
          </div>
        </div>

        {/* Placeholders reference */}
        {defaultTemplate && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Available Placeholders
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              Use these in your subject or body. They will be replaced with the
              practice&apos;s details when the email is generated in the Comms Hub.
            </p>
            <div className="flex flex-wrap gap-2">
              {defaultTemplate.placeholders.map((p) => (
                <code
                  key={p}
                  className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-mono"
                >
                  {p}
                </code>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
