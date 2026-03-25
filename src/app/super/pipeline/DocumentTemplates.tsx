'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { Button, Input, Dialog, FormField, Badge, Select, AlertBanner } from '@/components/ui'
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, type DocumentType } from './types'
import RichTextEditor from '@/components/rich-text/RichTextEditor'

// ── Placeholders per document type ──────────────────────────────────

const DOC_PLACEHOLDERS: Record<DocumentType, string[]> = {
  Proposal: ['{{practiceName}}', '{{contactName}}', '{{listSize}}', '{{estimatedFee}}', '{{contractStartDate}}'],
  SaasAgreement: ['{{practiceName}}', '{{contactName}}', '{{contactRole}}', '{{contractStartDate}}'],
  Dpa: ['{{practiceName}}', '{{contactName}}'],
  HostingOverview: ['{{practiceName}}'],
  IgSecurityPack: ['{{practiceName}}'],
}

// ── Types ───────────────────────────────────────────────────────────

interface ContractVariant {
  id: string
  name: string
  isDefault: boolean
  _count: { templates: number }
}

interface DocTemplate {
  id: string
  contractVariantId: string
  documentType: string
  contentHtml: string
  contentJson: string | null
}

// ── Component ───────────────────────────────────────────────────────

export default function DocumentTemplates() {
  const [variants, setVariants] = useState<ContractVariant[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<string>('')
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('Proposal')
  const [templates, setTemplates] = useState<DocTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editorContent, setEditorContent] = useState('')
  const [dirty, setDirty] = useState(false)

  // Create variant dialog
  const [showCreateVariant, setShowCreateVariant] = useState(false)
  const [newVariantName, setNewVariantName] = useState('')
  const [newVariantDefault, setNewVariantDefault] = useState(false)
  const [creatingVariant, setCreatingVariant] = useState(false)

  // Fetch variants on mount
  useEffect(() => {
    fetch('/api/super/pipeline/contract-variants')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setVariants(data)
          // Select the default variant initially
          const defaultV = data.find((v: ContractVariant) => v.isDefault) || data[0]
          if (defaultV) setSelectedVariantId(defaultV.id)
        }
      })
      .catch(() => toast.error('Failed to load variants'))
      .finally(() => setLoading(false))
  }, [])

  // Fetch templates when variant changes
  const fetchTemplates = useCallback((variantId: string) => {
    if (!variantId) return
    fetch(`/api/super/pipeline/contract-variants/${variantId}/templates`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTemplates(data)
        }
      })
      .catch(() => toast.error('Failed to load templates'))
  }, [])

  useEffect(() => {
    if (selectedVariantId) {
      fetchTemplates(selectedVariantId)
    }
  }, [selectedVariantId, fetchTemplates])

  // Load current template content into editor when doc type or templates change
  useEffect(() => {
    const tpl = templates.find((t) => t.documentType === selectedDocType)
    setEditorContent(tpl?.contentHtml ?? '')
    setDirty(false)
  }, [selectedDocType, templates])

  const currentTemplate = templates.find((t) => t.documentType === selectedDocType)
  const selectedVariant = variants.find((v) => v.id === selectedVariantId)

  async function handleSave() {
    if (!selectedVariantId) return
    setSaving(true)
    try {
      const res = await fetch(
        `/api/super/pipeline/contract-variants/${selectedVariantId}/templates/${selectedDocType}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentHtml: editorContent }),
        }
      )

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to save')
        return
      }

      const saved = await res.json()
      setTemplates((prev) => {
        const idx = prev.findIndex((t) => t.documentType === selectedDocType)
        if (idx >= 0) {
          const copy = [...prev]
          copy[idx] = saved
          return copy
        }
        return [...prev, saved]
      })
      setDirty(false)
      toast.success('Template saved')
    } catch {
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateVariant(e: React.FormEvent) {
    e.preventDefault()
    setCreatingVariant(true)
    try {
      const res = await fetch('/api/super/pipeline/contract-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newVariantName, isDefault: newVariantDefault }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to create variant')
        return
      }

      const created = await res.json()
      setVariants((prev) => {
        // If new variant is default, unset others
        const updated = newVariantDefault
          ? prev.map((v) => ({ ...v, isDefault: false }))
          : prev
        return [...updated, created]
      })
      setSelectedVariantId(created.id)
      setShowCreateVariant(false)
      setNewVariantName('')
      setNewVariantDefault(false)
      toast.success('Variant created')
    } catch {
      toast.error('An error occurred')
    } finally {
      setCreatingVariant(false)
    }
  }

  async function handleDeleteVariant() {
    if (!selectedVariant) return
    if (!confirm(`Delete variant "${selectedVariant.name}"? All its document templates will be deleted.`)) return

    try {
      const res = await fetch(`/api/super/pipeline/contract-variants/${selectedVariant.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete')
        return
      }

      setVariants((prev) => prev.filter((v) => v.id !== selectedVariant.id))
      const remaining = variants.filter((v) => v.id !== selectedVariant.id)
      setSelectedVariantId(remaining[0]?.id ?? '')
      toast.success('Variant deleted')
    } catch {
      toast.error('An error occurred')
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <p className="text-gray-500">Loading document templates...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Variant selector bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="flex items-end gap-4">
          <FormField label="Contract Variant" className="flex-1 mb-0">
            <Select
              value={selectedVariantId}
              onChange={(e) => {
                if (dirty && !confirm('You have unsaved changes. Discard them?')) return
                setSelectedVariantId(e.target.value)
              }}
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}{v.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </Select>
          </FormField>
          <Button variant="secondary" onClick={() => setShowCreateVariant(true)}>
            New Variant
          </Button>
          {selectedVariant && !selectedVariant.isDefault && (
            <Button variant="danger-soft" size="sm" onClick={handleDeleteVariant}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Document type nav */}
        <div className="lg:col-span-1">
          <nav className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {DOCUMENT_TYPES.map((dt) => {
              const hasTemplate = templates.some((t) => t.documentType === dt)
              return (
                <button
                  key={dt}
                  onClick={() => {
                    if (dirty && !confirm('You have unsaved changes. Discard them?')) return
                    setSelectedDocType(dt)
                  }}
                  className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 last:border-b-0 transition-colors flex items-center justify-between ${
                    selectedDocType === dt
                      ? 'bg-nhs-blue text-white'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span>{DOCUMENT_TYPE_LABELS[dt]}</span>
                  {hasTemplate && selectedDocType !== dt && (
                    <Badge color="green" size="sm">Ready</Badge>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Editor */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-nhs-dark-blue">
                {DOCUMENT_TYPE_LABELS[selectedDocType]}
              </h3>
              <div className="flex items-center gap-2">
                {currentTemplate && (
                  <Badge color="green" size="sm">Template exists</Badge>
                )}
                <Button onClick={handleSave} loading={saving} disabled={!dirty && !!currentTemplate}>
                  {saving ? 'Saving...' : currentTemplate ? 'Save Changes' : 'Create Template'}
                </Button>
              </div>
            </div>

            {dirty && (
              <AlertBanner variant="info" className="mb-4">
                You have unsaved changes.
              </AlertBanner>
            )}

            <RichTextEditor
              docId={`doc-template:${selectedVariantId}:${selectedDocType}`}
              value={editorContent}
              onChange={(html) => {
                setEditorContent(html)
                setDirty(true)
              }}
              height={450}
              placeholder="Start writing your document template..."
            />
          </div>

          {/* Placeholders reference */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Available Placeholders
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              Type these anywhere in the template. They will be replaced with the
              practice&apos;s details when the document is generated.
            </p>
            <div className="flex flex-wrap gap-2">
              {DOC_PLACEHOLDERS[selectedDocType].map((p) => (
                <code
                  key={p}
                  className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-mono"
                >
                  {p}
                </code>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Create Variant Dialog */}
      <Dialog
        open={showCreateVariant}
        onClose={() => setShowCreateVariant(false)}
        title="Create Contract Variant"
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateVariant(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-variant-form" loading={creatingVariant}>
              {creatingVariant ? 'Creating...' : 'Create'}
            </Button>
          </>
        }
      >
        <form id="create-variant-form" onSubmit={handleCreateVariant}>
          <FormField label="Variant Name" required>
            <Input
              value={newVariantName}
              onChange={(e) => setNewVariantName(e.target.value)}
              placeholder='e.g. "6-month free trial"'
              required
            />
          </FormField>
          <label className="flex items-center gap-2 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={newVariantDefault}
              onChange={(e) => setNewVariantDefault(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-nhs-blue focus:ring-nhs-blue"
            />
            <span className="text-sm text-gray-700">Set as default variant</span>
          </label>
        </form>
      </Dialog>
    </div>
  )
}
