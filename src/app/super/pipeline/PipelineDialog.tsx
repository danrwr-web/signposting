'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { Button, Dialog, Input, Select, Textarea, FormField } from '@/components/ui'
import { PipelineEntry, PIPELINE_STATUSES, STATUS_LABELS } from './types'

interface Props {
  open: boolean
  onClose: () => void
  entry: PipelineEntry | null // null = create mode
  onSaved: (entry: PipelineEntry) => void
}

const dateFields = [
  { key: 'dateEnquiry', label: 'Enquiry' },
  { key: 'dateDemoBooked', label: 'Demo Booked' },
  { key: 'dateDemoCompleted', label: 'Demo Completed' },
  { key: 'dateProposalSent', label: 'Proposal Sent' },
  { key: 'dateOnboardingFormSent', label: 'Onboarding Form Sent' },
  { key: 'dateSaasAgreementSent', label: 'SaaS Agreement Sent' },
  { key: 'dateSaasAgreementSigned', label: 'SaaS Agreement Signed' },
  { key: 'dateDpaSent', label: 'DPA Sent' },
  { key: 'dateDpaSigned', label: 'DPA Signed' },
  { key: 'dateContractStart', label: 'Contract Start' },
] as const

function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export default function PipelineDialog({ open, onClose, entry, onSaved }: Props) {
  const isEdit = !!entry
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(getDefaults(entry))
  const [feeManuallyEdited, setFeeManuallyEdited] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(getDefaults(entry))
      // If the entry already has a fee, treat it as manually set
      setFeeManuallyEdited(!!entry?.estimatedFeeGbp)
    }
  }, [open, entry])

  function getDefaults(e: PipelineEntry | null) {
    return {
      practiceName: e?.practiceName ?? '',
      townCity: e?.townCity ?? '',
      pcnName: e?.pcnName ?? '',
      listSize: e?.listSize?.toString() ?? '',
      estimatedFeeGbp: e?.estimatedFeeGbp?.toString() ?? '',
      contactName: e?.contactName ?? '',
      contactRole: e?.contactRole ?? '',
      contactEmail: e?.contactEmail ?? '',
      status: e?.status ?? 'Enquiry',
      freeTrial: e?.freeTrial ?? false,
      trialEndDate: toDateInputValue(e?.trialEndDate ?? null),
      annualValueGbp: e?.annualValueGbp?.toString() ?? '',
      contractVariantLabel: e?.contractVariantLabel ?? '',
      notes: e?.notes ?? '',
      // milestone dates
      dateEnquiry: toDateInputValue(e?.dateEnquiry ?? null),
      dateDemoBooked: toDateInputValue(e?.dateDemoBooked ?? null),
      dateDemoCompleted: toDateInputValue(e?.dateDemoCompleted ?? null),
      dateProposalSent: toDateInputValue(e?.dateProposalSent ?? null),
      dateOnboardingFormSent: toDateInputValue(e?.dateOnboardingFormSent ?? null),
      dateSaasAgreementSent: toDateInputValue(e?.dateSaasAgreementSent ?? null),
      dateSaasAgreementSigned: toDateInputValue(e?.dateSaasAgreementSigned ?? null),
      dateDpaSent: toDateInputValue(e?.dateDpaSent ?? null),
      dateDpaSigned: toDateInputValue(e?.dateDpaSigned ?? null),
      dateContractStart: toDateInputValue(e?.dateContractStart ?? null),
    }
  }

  function setField(key: string, value: string | boolean) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }

      // Auto-calculate fee when list size changes and fee hasn't been manually overridden
      if (key === 'listSize' && !feeManuallyEdited) {
        const size = parseInt(value as string, 10)
        next.estimatedFeeGbp = size > 0 ? (size * 0.07).toFixed(2) : ''
      }

      return next
    })
  }

  function handleFeeChange(value: string) {
    setFeeManuallyEdited(true)
    setForm((prev) => ({ ...prev, estimatedFeeGbp: value }))
  }

  function recalculateFee() {
    const size = parseInt(form.listSize, 10)
    setFeeManuallyEdited(false)
    setForm((prev) => ({
      ...prev,
      estimatedFeeGbp: size > 0 ? (size * 0.07).toFixed(2) : '',
    }))
  }

  const autoFee = form.listSize
    ? (parseInt(form.listSize, 10) * 0.07).toFixed(2)
    : ''
  const showRecalculate =
    feeManuallyEdited && form.listSize && form.estimatedFeeGbp !== autoFee

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const listSize = form.listSize ? parseInt(form.listSize, 10) : undefined
    const body: Record<string, unknown> = {
      practiceName: form.practiceName,
      townCity: form.townCity || undefined,
      pcnName: form.pcnName || undefined,
      listSize: listSize || undefined,
      contactName: form.contactName || undefined,
      contactRole: form.contactRole || undefined,
      contactEmail: form.contactEmail || undefined,
      status: form.status,
      freeTrial: form.freeTrial,
      annualValueGbp: form.annualValueGbp ? parseFloat(form.annualValueGbp) : undefined,
      contractVariantLabel: form.contractVariantLabel || undefined,
      notes: form.notes || undefined,
    }

    // Only include estimatedFeeGbp if explicitly filled (otherwise let API auto-calculate)
    if (form.estimatedFeeGbp) {
      body.estimatedFeeGbp = parseFloat(form.estimatedFeeGbp)
    }

    // Milestone dates
    for (const { key } of dateFields) {
      const val = form[key as keyof typeof form] as string
      if (val) body[key] = val
      else if (isEdit) body[key] = null // clear the date on edit
    }

    // Trial end date
    if (form.trialEndDate) body.trialEndDate = form.trialEndDate
    else if (isEdit) body.trialEndDate = null

    try {
      const url = isEdit ? `/api/super/pipeline/${entry!.id}` : '/api/super/pipeline'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to save')
        return
      }

      // Normalise dates to ISO strings for the client type
      const saved: PipelineEntry = {
        ...data,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }

      toast.success(isEdit ? 'Pipeline entry updated' : 'Pipeline entry created')
      onSaved(saved)
      onClose()
    } catch {
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Pipeline Entry' : 'Add Practice to Pipeline'}
      width="3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="pipeline-form" loading={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Practice'}
          </Button>
        </>
      }
    >
      <form id="pipeline-form" onSubmit={handleSubmit}>
        {/* Practice details */}
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Practice Details</h3>
        <div className="grid grid-cols-2 gap-x-4">
          <FormField label="Practice Name" required>
            <Input
              value={form.practiceName}
              onChange={(e) => setField('practiceName', e.target.value)}
              required
            />
          </FormField>
          <FormField label="Town / City">
            <Input
              value={form.townCity}
              onChange={(e) => setField('townCity', e.target.value)}
            />
          </FormField>
          <FormField label="PCN Name">
            <Input
              value={form.pcnName}
              onChange={(e) => setField('pcnName', e.target.value)}
            />
          </FormField>
          <FormField label="List Size">
            <Input
              type="number"
              value={form.listSize}
              onChange={(e) => setField('listSize', e.target.value)}
              min={0}
            />
          </FormField>
          <FormField label="Estimated Fee (£)">
            <Input
              type="number"
              step="0.01"
              value={form.estimatedFeeGbp}
              onChange={(e) => handleFeeChange(e.target.value)}
              placeholder="Auto-calculated from list size"
            />
            {showRecalculate && (
              <button
                type="button"
                onClick={recalculateFee}
                className="mt-1 text-xs text-nhs-blue hover:text-nhs-dark-blue"
              >
                Recalculate (£{autoFee})
              </button>
            )}
          </FormField>
          <FormField label="Annual Value (£)">
            <Input
              type="number"
              step="0.01"
              value={form.annualValueGbp}
              onChange={(e) => setField('annualValueGbp', e.target.value)}
            />
          </FormField>
        </div>

        {/* Contact details */}
        <h3 className="text-sm font-semibold text-gray-700 mb-3 mt-4">Contact Details</h3>
        <div className="grid grid-cols-3 gap-x-4">
          <FormField label="Contact Name">
            <Input
              value={form.contactName}
              onChange={(e) => setField('contactName', e.target.value)}
            />
          </FormField>
          <FormField label="Contact Role">
            <Input
              value={form.contactRole}
              onChange={(e) => setField('contactRole', e.target.value)}
            />
          </FormField>
          <FormField label="Contact Email">
            <Input
              type="email"
              value={form.contactEmail}
              onChange={(e) => setField('contactEmail', e.target.value)}
            />
          </FormField>
        </div>

        {/* Status & contract */}
        <h3 className="text-sm font-semibold text-gray-700 mb-3 mt-4">Status</h3>
        <div className="grid grid-cols-3 gap-x-4">
          <FormField label="Pipeline Status">
            <Select
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
            >
              {PIPELINE_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Contract Variant">
            <Input
              value={form.contractVariantLabel}
              onChange={(e) => setField('contractVariantLabel', e.target.value)}
              placeholder="e.g. Standard, 6-month free trial"
            />
          </FormField>
          <FormField label="Free Trial">
            <div className="flex items-center h-[38px]">
              <input
                type="checkbox"
                checked={form.freeTrial}
                onChange={(e) => setField('freeTrial', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-nhs-blue focus:ring-nhs-blue"
              />
              <span className="ml-2 text-sm text-gray-600">Yes</span>
            </div>
          </FormField>
        </div>
        {form.freeTrial && (
          <div className="grid grid-cols-3 gap-x-4">
            <FormField label="Trial End Date">
              <Input
                type="date"
                value={form.trialEndDate}
                onChange={(e) => setField('trialEndDate', e.target.value)}
              />
            </FormField>
          </div>
        )}

        {/* Milestone dates */}
        <h3 className="text-sm font-semibold text-gray-700 mb-3 mt-4">Milestone Dates</h3>
        <div className="grid grid-cols-3 gap-x-4">
          {dateFields.map(({ key, label }) => (
            <FormField key={key} label={label}>
              <Input
                type="date"
                value={form[key as keyof typeof form] as string}
                onChange={(e) => setField(key, e.target.value)}
              />
            </FormField>
          ))}
        </div>

        {/* Notes */}
        <h3 className="text-sm font-semibold text-gray-700 mb-3 mt-4">Notes</h3>
        <Textarea
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          rows={3}
          placeholder="Any additional notes..."
        />
      </form>
    </Dialog>
  )
}
