'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import { Button, Select, Input, FormField, Badge, AlertBanner } from '@/components/ui'
import { PipelineEntry, PipelineStatus, STATUS_LABELS } from './types'

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
    { key: 'estimatedFee', label: 'Estimated Monthly Fee (£)', type: 'number', placeholder: 'Auto-calculated' },
  ],
  ProposalSent: [
    ...COMMON_FIELDS,
    { key: 'listSize', label: 'List Size', type: 'number' },
    { key: 'estimatedFee', label: 'Estimated Monthly Fee (£)', type: 'number' },
  ],
  DocumentsSent: [
    ...COMMON_FIELDS,
    { key: 'listSize', label: 'List Size', type: 'number' },
    { key: 'estimatedFee', label: 'Estimated Monthly Fee (£)', type: 'number' },
    { key: 'contractStartDate', label: 'Contract Start Date', type: 'date' },
  ],
  Contracted: [
    ...COMMON_FIELDS,
    { key: 'contractStartDate', label: 'Contract Start Date', type: 'date' },
  ],
}

// ── Document definitions (placeholder only) ─────────────────────────

const STAGE_DOCUMENTS: Partial<Record<CommsStage, string[]>> = {
  DemoCompleted: ['Post-Demo Proposal'],
  ProposalSent: [
    'SaaS Agreement',
    'Data Processing Agreement',
    'Hosting & IG Overview',
    'IG & Security Response Pack',
  ],
}

// ── Email templates ─────────────────────────────────────────────────

function placeholder(val: string | undefined, name: string): string {
  if (val && val.trim()) return val
  return `[${name}]`
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

function getEmailTemplate(
  stage: CommsStage,
  f: Fields
): { subject: string; body: string } {
  const name = placeholder(f.contactName, 'Contact Name')
  const practice = placeholder(f.practiceName, 'Practice Name')
  const fee = placeholder(f.estimatedFee, 'Monthly Fee')
  const listSize = placeholder(f.listSize, 'List Size')
  const demoDate = placeholder(f.demoDate ? formatDateForEmail(f.demoDate) : '', 'Demo Date')
  const demoTime = placeholder(f.demoTime ? formatTimeForEmail(f.demoTime) : '', 'Demo Time')
  const startDate = placeholder(
    f.contractStartDate ? formatDateForEmail(f.contractStartDate) : '',
    'Contract Start Date'
  )

  switch (stage) {
    case 'Enquiry':
      return {
        subject: `Signposting Toolkit — Enquiry from ${practice}`,
        body: `Dear ${name},

Thank you for your enquiry about the Signposting Toolkit. We'd love to show you how it can help your reception team at ${practice} direct patients to the right service, first time.

Would you have 20 minutes for a short online demo? I'm flexible on times and happy to work around your schedule.

I look forward to hearing from you.

Kind regards,
Dan`,
      }

    case 'DemoBooked':
      return {
        subject: `Signposting Toolkit Demo — ${demoDate} at ${demoTime}`,
        body: `Dear ${name},

Great to speak with you. I've booked your demo for ${demoDate} at ${demoTime}.

I'll send a Teams invite shortly. The demo takes around 20 minutes and I'll walk through how the Signposting Toolkit works in practice, with real examples relevant to ${practice}.

If you need to reschedule, just let me know.

Kind regards,
Dan`,
      }

    case 'DemoCompleted':
      return {
        subject: `Signposting Toolkit — Proposal for ${practice}`,
        body: `Dear ${name},

Thank you for taking the time to see the Signposting Toolkit in action. As discussed, I've attached a proposal tailored to ${practice}.

Based on your list size of ${listSize} patients, the monthly fee would be £${fee}.

The proposal covers what's included, how onboarding works, and the timeline to get your team up and running. I'm happy to answer any questions or arrange a follow-up call.

Kind regards,
Dan`,
      }

    case 'ProposalSent':
      return {
        subject: `Signposting Toolkit — Documents for ${practice}`,
        body: `Dear ${name},

Following on from our proposal, I've attached the formal documents for your review:

1. SaaS Agreement
2. Data Processing Agreement (DPA)
3. Hosting & Information Governance Overview
4. IG & Security Response Pack

These cover the contractual terms, data handling, and security arrangements. Everything is designed to meet NHS IG and DTAC standards.

If you have any questions or need anything reviewed by your practice manager or Caldicott Guardian, I'm happy to help.

Kind regards,
Dan`,
      }

    case 'DocumentsSent':
      return {
        subject: `Signposting Toolkit — Next steps for ${practice}`,
        body: `Dear ${name},

Just checking in on the documents I sent across. Have you had a chance to review them? I'm happy to jump on a call if anything needs clarifying.

Once the agreements are signed, we can get ${practice} set up and your team trained. The onboarding process typically takes around 1–2 weeks from contract start.

Looking forward to hearing from you.

Kind regards,
Dan`,
      }

    case 'Contracted':
      return {
        subject: `Welcome to the Signposting Toolkit — ${practice}`,
        body: `Dear ${name},

Welcome aboard! I'm delighted that ${practice} has chosen the Signposting Toolkit.

Your contract start date is ${startDate}. Here's what happens next:

1. I'll set up your surgery on the platform and send you admin login details
2. We'll schedule a short onboarding call to configure your practice's settings
3. I'll provide training materials for your reception team

I'll be in touch shortly with your login details. In the meantime, if you have any questions at all, don't hesitate to reach out.

Kind regards,
Dan`,
      }
  }
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

  // When practice selection changes, pre-fill fields and default stage
  useEffect(() => {
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
      estimatedFee: entry.estimatedFeeGbp?.toString() ?? '',
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
    ? (parseInt(fields.listSize, 10) * 0.07).toFixed(2)
    : ''

  // Email template
  const email = useMemo(() => getEmailTemplate(stage, fields), [stage, fields])
  const hasMissing = hasPlaceholders(email.body)

  // Documents for this stage
  const documents = STAGE_DOCUMENTS[stage] ?? []

  // Currently selected pipeline entry
  const selectedEntry = entries.find((e) => e.id === selectedPracticeId)

  // Whether the pipeline status differs from the selected comms stage
  const canUpdateStage =
    selectedEntry &&
    selectedEntry.status !== stage &&
    COMMS_STAGES.includes(stage) &&
    !stageUpdated

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
                {documents.map((doc) => (
                  <div
                    key={doc}
                    className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                  >
                    <span className="text-sm text-gray-700">{doc}</span>
                    <span title="Coming soon — document templates not yet configured">
                      <Button variant="secondary" size="sm" disabled>
                        Generate &amp; Download
                      </Button>
                    </span>
                  </div>
                ))}
                <p className="text-xs text-gray-400 mt-1">
                  Document generation will be available when the template system is configured.
                </p>
              </div>
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
    </div>
  )
}
