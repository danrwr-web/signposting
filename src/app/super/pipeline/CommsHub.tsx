'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import { Button, Select, Input, FormField, Badge, AlertBanner, Dialog } from '@/components/ui'
import { PipelineEntry, PipelineStatus, STATUS_LABELS, DocumentType, DOCUMENT_TYPE_LABELS, SHARED_DOC_TYPES } from './types'
import { generateDocument } from './documentGenerator'
import {
  DEFAULT_EMAIL_TEMPLATES,
  STAGE_TO_TEMPLATE_KEY,
} from './emailTemplateDefaults'

// ── Stage definitions ───────────────────────────────────────────────

const COMMS_STAGES = [
  'Enquiry',
  'DemoBooked',
  'DemoCompleted',
  'ProposalSent',
  'DocumentsSent',
  'Contracted',
] as const

type CommsStage = (typeof COMMS_STAGES)[number]

const STAGE_LABELS: Record<CommsStage, string> = {
  Enquiry: 'Enquiry Received',
  DemoBooked: 'Demo Booked',
  DemoCompleted: 'Demo Completed',
  ProposalSent: 'Proposal Sent',
  DocumentsSent: 'Documents Sent',
  Contracted: 'Contracted',
}

// ── Fields per stage ────────────────────────────────────────────────

type FieldKey =
  | 'practiceName'
  | 'contactName'
  | 'contactEmail'
  | 'listSize'
  | 'estimatedFee'
  | 'demoDate'
  | 'demoTime'
  | 'contractStartDate'

interface FieldDef {
  key: FieldKey
  label: string
  type?: 'email' | 'number' | 'date' | 'time'
  placeholder?: string
}

const COMMON_FIELDS: FieldDef[] = [
  { key: 'practiceName', label: 'Practice Name', placeholder: 'e.g. Riverside Medical Centre' },
  { key: 'contactName', label: 'Contact Name', placeholder: 'e.g. Sarah' },
  { key: 'contactEmail', label: 'Contact Email', type: 'email', placeholder: 'e.g. sarah@practice.nhs.uk' },
]

const STAGE_FIELDS: Record<CommsStage, FieldDef[]> = {
  Enquiry: [...COMMON_FIELDS],
  DemoBooked: [
    ...COMMON_FIELDS,
    { key: 'demoDate', label: 'Demo Date', type: 'date' },
    { key: 'demoTime', label: 'Demo Time', type: 'time' },
  ],
  DemoCompleted: [
    ...COMMON_FIELDS,
    { key: 'listSize', label: 'List Size', type: 'number', placeholder: 'e.g. 8500' },
    { key: 'estimatedFee', label: 'Estimated Annual Fee (£)', type: 'number', placeholder: 'Auto-calculated' },
  ],
  ProposalSent: [
    ...COMMON_FIELDS,
    { key: 'listSize', label: 'List Size', type: 'number' },
    { key: 'estimatedFee', label: 'Estimated Annual Fee (£)', type: 'number' },
  ],
  DocumentsSent: [
    ...COMMON_FIELDS,
    { key: 'listSize', label: 'List Size', type: 'number' },
    { key: 'estimatedFee', label: 'Estimated Annual Fee (£)', type: 'number' },
    { key: 'contractStartDate', label: 'Contract Start Date', type: 'date' },
  ],
  Contracted: [
    ...COMMON_FIELDS,
    { key: 'contractStartDate', label: 'Contract Start Date', type: 'date' },
  ],
}

// ── Document definitions ─────────────────────────────────────────────

const STAGE_DOCUMENTS: Partial<Record<CommsStage, DocumentType[]>> = {
  DemoCompleted: ['Proposal'],
  ProposalSent: ['SaasAgreement', 'Dpa', 'HostingOverview', 'IgSecurityPack'],
}

// ── Email template substitution ─────────────────────────────────────

interface Fields {
  practiceName: string
  contactName: string
  contactEmail: string
  listSize: string
  estimatedFee: string
  demoDate: string
  demoTime: string
  contractStartDate: string
}

function formatDateForEmail(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTimeForEmail(timeStr: string): string {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h, 10)
  const suffix = hour >= 12 ? 'pm' : 'am'
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}${m !== '00' ? `:${m}` : ''}${suffix}`
}

/** Replace {{placeholders}} with field values, showing [Label] for missing ones */
function substituteTemplate(template: string, f: Fields): string {
  const replacements: Record<string, { value: string; label: string }> = {
    '{{contactName}}': { value: f.contactName, label: 'Contact Name' },
    '{{practiceName}}': { value: f.practiceName, label: 'Practice Name' },
    '{{listSize}}': { value: f.listSize, label: 'List Size' },
    '{{estimatedFee}}': { value: f.estimatedFee, label: 'Annual Fee' },
    '{{demoDate}}': { value: f.demoDate ? formatDateForEmail(f.demoDate) : '', label: 'Demo Date' },
    '{{demoTime}}': { value: f.demoTime ? formatTimeForEmail(f.demoTime) : '', label: 'Demo Time' },
    '{{contractStartDate}}': {
      value: f.contractStartDate ? formatDateForEmail(f.contractStartDate) : '',
      label: 'Contract Start Date',
    },
  }

  let result = template
  for (const [placeholder, { value, label }] of Object.entries(replacements)) {
    const replacement = value.trim() ? value : `[${label}]`
    result = result.split(placeholder).join(replacement)
  }
  return result
}

function hasPlaceholders(text: string): boolean {
  return /\[[^\]]+\]/.test(text)
}

function highlightPlaceholders(text: string): React.ReactNode[] {
  const parts = text.split(/(\[[^\]]+\])/)
  return parts.map((part, i) => {
    if (/^\[.*\]$/.test(part)) {
      return (
        <span key={i} className="text-red-500 font-medium">{part}</span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

/** Build fallback template map from hardcoded defaults */
function buildDefaultTemplateMap(): Record<string, { subject: string; body: string }> {
  const map: Record<string, { subject: string; body: string }> = {}
  for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
    map[tpl.stage] = { subject: tpl.subject, body: tpl.body }
  }
  return map
}

// ── Component ───────────────────────────────────────────────────────

interface Props {
  entries: PipelineEntry[]
  setEntries: React.Dispatch<React.SetStateAction<PipelineEntry[]>>
}

function statusToStage(status: PipelineStatus): CommsStage {
  if (COMMS_STAGES.includes(status as CommsStage)) return status as CommsStage
  // OnHold / Lost don't map to a comms stage — default to Enquiry
  return 'Enquiry'
}

export default function CommsHub({ entries, setEntries }: Props) {
  const [selectedPracticeId, setSelectedPracticeId] = useState<string>('manual')
  const [stage, setStage] = useState<CommsStage>('Enquiry')
  const [fields, setFields] = useState<Fields>({
    practiceName: '',
    contactName: '',
    contactEmail: '',
    listSize: '',
    estimatedFee: '',
    demoDate: '',
    demoTime: '',
    contractStartDate: '',
  })
  const [stageUpdated, setStageUpdated] = useState(false)
  const [templateMap, setTemplateMap] = useState<Record<string, { subject: string; body: string }>>(
    buildDefaultTemplateMap
  )

  // Setup Guide state
  const [setupGuideTemplateExists, setSetupGuideTemplateExists] = useState(false)
  const [showSetupGuideConfirm, setShowSetupGuideConfirm] = useState(false)
  const [generatingSetupGuide, setGeneratingSetupGuide] = useState(false)
  const [setupGuideGenerated, setSetupGuideGenerated] = useState(false)

  // Check whether a setup guide template exists on mount. HEAD avoids
  // downloading the template bytes.
  useEffect(() => {
    fetch('/api/super/pipeline/setup-guide-template', { method: 'HEAD' })
      .then((r) => setSetupGuideTemplateExists(r.ok))
      .catch(() => setSetupGuideTemplateExists(false))
  }, [])

  // Fetch customised templates on mount — fall back to defaults on failure
  useEffect(() => {
    fetch('/api/super/pipeline/email-templates')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const map: Record<string, { subject: string; body: string }> = {}
          for (const tpl of data) {
            map[tpl.stage] = { subject: tpl.subject, body: tpl.body }
          }
          setTemplateMap((prev) => ({ ...prev, ...map }))
        }
      })
      .catch(() => {
        // Silently fall back to hardcoded defaults
      })
  }, [])

  // Document templates: track which document types have an uploaded .docx
  // Variant-specific types use the practice's variant; shared types use the default variant
  const [docTemplateTypes, setDocTemplateTypes] = useState<Set<string>>(new Set())
  const [docVariantId, setDocVariantId] = useState('')
  const [defaultVariantId, setDefaultVariantId] = useState('')
  // Map from documentType to the variantId that owns the template (for generation)
  const [docVariantMap, setDocVariantMap] = useState<Record<string, string>>({})

  // Fetch default variant ID on mount
  useEffect(() => {
    fetch('/api/super/pipeline/contract-variants')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const def = data.find((v: { isDefault: boolean }) => v.isDefault)
          if (def) setDefaultVariantId(def.id)
        }
      })
      .catch(() => {})
  }, [])

  // Fetch document template lists when practice selection or default variant changes
  useEffect(() => {
    const entry = entries.find((e) => e.id === selectedPracticeId)
    const variantId = entry?.contractVariantId
    if (!variantId && !defaultVariantId) {
      setDocTemplateTypes(new Set())
      setDocVariantId('')
      setDocVariantMap({})
      return
    }

    setDocVariantId(variantId || defaultVariantId)
    const available = new Set<string>()
    const varMap: Record<string, string> = {}

    const fetches: Promise<void>[] = []

    // Fetch variant-specific templates from the practice's variant
    if (variantId) {
      fetches.push(
        fetch(`/api/super/pipeline/contract-variants/${variantId}/templates`)
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data)) {
              for (const t of data) {
                if (!SHARED_DOC_TYPES.includes(t.documentType)) {
                  available.add(t.documentType)
                  varMap[t.documentType] = variantId
                }
              }
            }
          })
          .catch(() => {})
      )
    }

    // Fetch shared templates from the default variant
    if (defaultVariantId) {
      fetches.push(
        fetch(`/api/super/pipeline/contract-variants/${defaultVariantId}/templates`)
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data)) {
              for (const t of data) {
                if (SHARED_DOC_TYPES.includes(t.documentType)) {
                  available.add(t.documentType)
                  varMap[t.documentType] = defaultVariantId
                }
              }
            }
          })
          .catch(() => {})
      )
    }

    Promise.all(fetches).then(() => {
      setDocTemplateTypes(available)
      setDocVariantMap(varMap)
    })
  }, [selectedPracticeId, entries, defaultVariantId])

  // When practice selection changes, pre-fill fields and default stage
  useEffect(() => {
    setSetupGuideGenerated(false)

    if (selectedPracticeId === 'manual') {
      setFields({
        practiceName: '',
        contactName: '',
        contactEmail: '',
        listSize: '',
        estimatedFee: '',
        demoDate: '',
        demoTime: '',
        contractStartDate: '',
      })
      setStage('Enquiry')
      setStageUpdated(false)
      return
    }

    const entry = entries.find((e) => e.id === selectedPracticeId)
    if (!entry) return

    setFields({
      practiceName: entry.practiceName,
      contactName: entry.contactName ?? '',
      contactEmail: entry.contactEmail ?? '',
      listSize: entry.listSize?.toString() ?? '',
      estimatedFee: entry.estimatedFeeGbp != null ? entry.estimatedFeeGbp.toFixed(2) : '',
      demoDate: entry.dateDemoBooked?.slice(0, 10) ?? '',
      demoTime: '',
      contractStartDate: entry.dateContractStart?.slice(0, 10) ?? '',
    })
    setStage(statusToStage(entry.status))
    setStageUpdated(false)
  }, [selectedPracticeId, entries])

  function setField(key: FieldKey, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  // Auto-calculate fee hint
  const showFeeHint =
    fields.listSize &&
    !fields.estimatedFee &&
    STAGE_FIELDS[stage].some((f) => f.key === 'estimatedFee')

  const autoFee = fields.listSize
    ? (Math.round(parseInt(fields.listSize, 10) * 7) / 100).toFixed(2)
    : ''

  // Email template — look up from API templates, substitute field values
  const email = useMemo(() => {
    const key = STAGE_TO_TEMPLATE_KEY[stage]
    const tpl = templateMap[key] ?? buildDefaultTemplateMap()[key]
    if (!tpl) return { subject: '', body: '' }
    return {
      subject: substituteTemplate(tpl.subject, fields),
      body: substituteTemplate(tpl.body, fields),
    }
  }, [stage, fields, templateMap])
  const hasMissing = hasPlaceholders(email.body)

  // Documents for this stage
  const documents = STAGE_DOCUMENTS[stage] ?? []

  // Currently selected pipeline entry
  const selectedEntry = entries.find((e) => e.id === selectedPracticeId)

  // Whether the pipeline status differs from the selected comms stage
  const canUpdateStage =
    selectedEntry &&
    selectedEntry.status !== 'Lost' &&
    selectedEntry.status !== 'OnHold' &&
    selectedEntry.status !== stage &&
    COMMS_STAGES.includes(stage) &&
    !stageUpdated

  async function handleGenerateDoc(docType: DocumentType) {
    const templateVariantId = docVariantMap[docType]
    if (!templateVariantId || !docTemplateTypes.has(docType)) return

    try {
      await generateDocument(
        templateVariantId,
        docType,
        {
          practiceName: fields.practiceName,
          practiceAddress: entries.find((e) => e.id === selectedPracticeId)?.practiceAddress ?? '',
          contactName: fields.contactName,
          contactRole: '',
          contactEmail: fields.contactEmail,
          listSize: fields.listSize,
          estimatedFee: fields.estimatedFee,
          contractStartDate: fields.contractStartDate
            ? formatDateForEmail(fields.contractStartDate)
            : '',
        }
      )
      toast.success(`${DOCUMENT_TYPE_LABELS[docType]} downloaded`)
    } catch {
      toast.error('Failed to generate document')
    }
  }

  async function handleGenerateSetupGuide() {
    if (!selectedEntry) return
    setGeneratingSetupGuide(true)
    try {
      const res = await fetch(
        `/api/super/pipeline/${selectedEntry.id}/generate-setup-guide`,
        { method: 'POST' }
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to generate' }))
        toast.error(data.error || 'Failed to generate setup guide')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Setup Guide - ${selectedEntry.practiceName}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSetupGuideGenerated(true)
      setShowSetupGuideConfirm(false)
      toast.success('Setup guide generated')
    } catch {
      toast.error('An error occurred')
    } finally {
      setGeneratingSetupGuide(false)
    }
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied to clipboard`)
    } catch {
      toast.error('Failed to copy')
    }
  }

  async function updatePipelineStage() {
    if (!selectedEntry) return
    try {
      const res = await fetch(`/api/super/pipeline/${selectedEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: stage }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to update stage')
        return
      }
      const updated = await res.json()
      setEntries((prev) =>
        prev.map((e) => (e.id === selectedEntry.id ? { ...updated } : e))
      )
      setStageUpdated(true)
      toast.success(`Pipeline status updated to ${STAGE_LABELS[stage]}`)
    } catch {
      toast.error('An error occurred')
    }
  }

  return (
    <div className="space-y-6">
      {/* Practice & stage selectors */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Practice">
            <Select
              value={selectedPracticeId}
              onChange={(e) => setSelectedPracticeId(e.target.value)}
            >
              <option value="manual">-- Manual entry --</option>
              {entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.practiceName} — {STATUS_LABELS[entry.status]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Communication Stage">
            <Select
              value={stage}
              onChange={(e) => {
                setStage(e.target.value as CommsStage)
                setStageUpdated(false)
              }}
            >
              {COMMS_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column — fields + documents */}
        <div className="space-y-6">
          {/* Fields panel */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Details</h3>
            <div className="space-y-0">
              {STAGE_FIELDS[stage].map((field) => (
                <FormField key={field.key} label={field.label}>
                  <Input
                    type={field.type ?? 'text'}
                    value={fields[field.key]}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                </FormField>
              ))}
            </div>

            {showFeeHint && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                <span>Suggested fee: £{autoFee}/month</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setField('estimatedFee', autoFee)}
                >
                  Use this
                </Button>
              </div>
            )}
          </div>

          {/* Documents panel */}
          {documents.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Documents</h3>
              <div className="space-y-2">
                {documents.map((docType) => {
                  const hasTemplate = docTemplateTypes.has(docType)
                  return (
                    <div
                      key={docType}
                      className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                    >
                      <span className="text-sm text-gray-700">
                        {DOCUMENT_TYPE_LABELS[docType]}
                      </span>
                      <span title={hasTemplate ? undefined : 'No template configured for this variant'}>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!hasTemplate}
                          onClick={() => handleGenerateDoc(docType)}
                        >
                          Generate &amp; Download
                        </Button>
                      </span>
                    </div>
                  )
                })}
                {selectedPracticeId === 'manual' && (
                  <p className="text-xs text-gray-400 mt-1">
                    Select a practice from the dropdown to enable document generation.
                  </p>
                )}
                {selectedPracticeId !== 'manual' && docTemplateTypes.size === 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    No document templates configured for this practice&apos;s contract variant.
                    Set up templates in the Templates tab.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Setup Guide — only visible once the practice has been provisioned */}
          {selectedEntry?.linkedSurgeryId && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Setup Guide</h3>
              {!setupGuideTemplateExists ? (
                <p className="text-sm text-gray-500">
                  No setup guide template uploaded yet. Upload a{' '}
                  <span className="font-medium">Practice Setup Guide</span> in the
                  Templates &rarr; Document Templates tab first.
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    Generate a personalised setup guide for the practice admin.
                    This resets the admin user&apos;s password and embeds the new
                    password in the document only.
                  </p>
                  {setupGuideGenerated && (
                    <AlertBanner variant="success" className="mb-3">
                      Setup guide generated. The admin user&apos;s password has
                      been reset and is embedded in the document only.
                    </AlertBanner>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => setShowSetupGuideConfirm(true)}
                  >
                    Generate Setup Guide
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right column — email draft */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Email Draft</h3>

          {hasMissing && (
            <AlertBanner variant="warning" className="mb-3">
              Some fields are still missing — placeholders shown in red.
            </AlertBanner>
          )}

          {/* Subject */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Subject
            </p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
              {highlightPlaceholders(email.subject)}
            </div>
          </div>

          {/* Body */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Body
            </p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
              {highlightPlaceholders(email.body)}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => copyToClipboard(email.body, 'Email body')}
            >
              Copy Body
            </Button>
            <Button
              size="sm"
              onClick={() =>
                copyToClipboard(
                  `Subject: ${email.subject}\n\n${email.body}`,
                  'Email with subject'
                )
              }
            >
              Copy with Subject
            </Button>
          </div>

          {/* Update pipeline stage shortcut */}
          {canUpdateStage && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-sm text-blue-800 flex-1">
                Update pipeline status to <Badge color="blue" size="sm">{STAGE_LABELS[stage]}</Badge>?
              </p>
              <Button size="sm" onClick={updatePipelineStage}>
                Update Stage
              </Button>
            </div>
          )}

          {stageUpdated && (
            <div className="mt-4">
              <AlertBanner variant="success">
                Pipeline status updated to {STAGE_LABELS[stage]}.
              </AlertBanner>
            </div>
          )}
        </div>
      </div>

      {/* Setup Guide confirmation dialog */}
      <Dialog
        open={showSetupGuideConfirm}
        onClose={() => setShowSetupGuideConfirm(false)}
        title="Generate Setup Guide"
        description="This will reset the admin user's password."
        width="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowSetupGuideConfirm(false)}
              disabled={generatingSetupGuide}
            >
              Cancel
            </Button>
            <Button onClick={handleGenerateSetupGuide} loading={generatingSetupGuide}>
              Generate &amp; Download
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-gray-700">
          <p>
            A new temporary password will be generated for{' '}
            <span className="font-medium">{selectedEntry?.practiceName}</span>
            &apos;s admin user. The plaintext password is embedded in the
            downloaded document only — it is never stored.
          </p>
          <p>
            The admin&apos;s existing password will be replaced immediately. They
            will need the new password from the setup guide to sign in.
          </p>
        </div>
      </Dialog>
    </div>
  )
}
