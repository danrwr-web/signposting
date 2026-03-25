'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { Button, Input, Dialog, FormField, Badge, Select, AlertBanner } from '@/components/ui'
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, type DocumentType } from './types'

// ── Placeholders per document type ──────────────────────────────────

const DOC_PLACEHOLDERS: Record<DocumentType, string[]> = {
  Proposal: ['{{practiceName}}', '{{practiceAddress}}', '{{contactName}}', '{{listSize}}', '{{estimatedFee}}', '{{contractStartDate}}'],
  SaasAgreement: ['{{practiceName}}', '{{practiceAddress}}', '{{contactName}}', '{{contactRole}}', '{{contractStartDate}}'],
  Dpa: ['{{practiceName}}', '{{practiceAddress}}', '{{contactName}}'],
  HostingOverview: ['{{practiceName}}', '{{practiceAddress}}'],
  IgSecurityPack: ['{{practiceName}}', '{{practiceAddress}}'],
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
  fileName: string | null
  createdAt: string
  updatedAt: string
}

// ── Component ───────────────────────────────────────────────────────

export default function DocumentTemplates() {
  const [variants, setVariants] = useState<ContractVariant[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<string>('')
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('Proposal')
  const [templates, setTemplates] = useState<DocTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        if (Array.isArray(data)) setTemplates(data)
      })
      .catch(() => toast.error('Failed to load templates'))
  }, [])

  useEffect(() => {
    if (selectedVariantId) fetchTemplates(selectedVariantId)
  }, [selectedVariantId, fetchTemplates])

  const currentTemplate = templates.find((t) => t.documentType === selectedDocType)
  const selectedVariant = variants.find((v) => v.id === selectedVariantId)

  // ── Upload handler ────────────────────────────────────────────────

  async function handleUpload(file: File) {
    if (!file.name.endsWith('.docx')) {
      toast.error('Only .docx files are accepted')
      return
    }
    if (!selectedVariantId) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(
        `/api/super/pipeline/contract-variants/${selectedVariantId}/templates/${selectedDocType}`,
        { method: 'PUT', body: formData }
      )

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Upload failed')
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
      toast.success('Template uploaded')
    } catch {
      toast.error('An error occurred')
    } finally {
      setUploading(false)
      // Reset file input so the same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  // ── Download handler ──────────────────────────────────────────────

  function handleDownload() {
    if (!selectedVariantId || !currentTemplate) return
    window.open(
      `/api/super/pipeline/contract-variants/${selectedVariantId}/templates/${selectedDocType}`,
      '_blank'
    )
  }

  // ── Delete handler ────────────────────────────────────────────────

  async function handleDelete() {
    if (!selectedVariantId || !currentTemplate) return
    if (!confirm(`Delete the ${DOCUMENT_TYPE_LABELS[selectedDocType]} template?`)) return

    try {
      const res = await fetch(
        `/api/super/pipeline/contract-variants/${selectedVariantId}/templates/${selectedDocType}`,
        { method: 'DELETE' }
      )

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete')
        return
      }

      setTemplates((prev) => prev.filter((t) => t.documentType !== selectedDocType))
      toast.success('Template deleted')
    } catch {
      toast.error('An error occurred')
    }
  }

  // ── Variant management ────────────────────────────────────────────

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
              onChange={(e) => setSelectedVariantId(e.target.value)}
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
                  onClick={() => setSelectedDocType(dt)}
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

        {/* Upload / template management */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-nhs-dark-blue">
                {DOCUMENT_TYPE_LABELS[selectedDocType]}
              </h3>
              {currentTemplate && (
                <Badge color="green" size="sm">Template uploaded</Badge>
              )}
            </div>

            {currentTemplate ? (
              /* ── Template exists ──────────────────────────────────── */
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {currentTemplate.fileName || 'template.docx'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Uploaded {new Date(currentTemplate.updatedAt).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}{' '}at{' '}
                        {new Date(currentTemplate.updatedAt).toLocaleTimeString('en-GB', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={handleDownload}>
                        Download
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        loading={uploading}
                      >
                        Replace
                      </Button>
                      <Button variant="danger-soft" size="sm" onClick={handleDelete}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>

                <AlertBanner variant="info">
                  To edit, download the template, modify it in Word, then re-upload.
                </AlertBanner>
              </div>
            ) : (
              /* ── No template — upload drop zone ───────────────────── */
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-nhs-blue transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-10 h-10 mx-auto text-gray-400 mb-3"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm text-gray-600 mb-1">
                  Drag and drop a .docx template here, or
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploading}
                >
                  Choose File
                </Button>
                <p className="text-xs text-gray-400 mt-2">
                  Upload a Word document containing {'{{'}placeholders{'}}'}  that will be
                  substituted with practice details at generation time.
                </p>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* Placeholders reference */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Available Placeholders
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              Use these in your Word template. They will be replaced with the
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

            <h4 className="text-sm font-semibold text-gray-700 mt-4 mb-2">
              Auto-generated
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              These are populated automatically at generation time.
            </p>
            <div className="flex flex-wrap gap-2">
              <code className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-1 rounded text-xs font-mono">
                {'{{currentDate}}'}
              </code>
              <code className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-1 rounded text-xs font-mono">
                {'{{currentYear}}'}
              </code>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {'{{currentDate}}'} inserts today&apos;s date (e.g. &ldquo;25 March 2026&rdquo;).{' '}
              {'{{currentYear}}'} inserts the four-digit year (e.g. &ldquo;2026&rdquo;).
            </p>
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
