'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { Button, Dialog, Input, FormField, Badge, AlertBanner } from '@/components/ui'
import { PipelineEntry } from './types'

interface Feature {
  id: string
  key: string
  name: string
  description: string | null
}

interface Props {
  entries: PipelineEntry[]
  setEntries: React.Dispatch<React.SetStateAction<PipelineEntry[]>>
}

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => chars[b % chars.length]).join('')
}

export default function ProvisionSurgery({ entries, setEntries }: Props) {
  const [features, setFeatures] = useState<Feature[]>([])
  const [provisioningEntry, setProvisioningEntry] = useState<PipelineEntry | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state for provision dialog
  const [surgeryName, setSurgeryName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminName, setAdminName] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [selectedFlags, setSelectedFlags] = useState<Set<string>>(new Set())
  const [provisionedResult, setProvisionedResult] = useState<{ surgeryId: string } | null>(null)

  // Filter to contracted entries without a linked surgery
  const unprovisionedEntries = useMemo(
    () => entries.filter((e) => e.status === 'Contracted' && !e.linkedSurgeryId),
    [entries]
  )

  // Fetch available feature flags
  useEffect(() => {
    fetch('/api/features')
      .then((r) => r.json())
      .then((data) => {
        if (data.features) setFeatures(data.features)
      })
      .catch(() => {
        // Silently fail — flags will just show empty
      })
  }, [])

  function openProvision(entry: PipelineEntry) {
    setProvisioningEntry(entry)
    setSurgeryName(entry.practiceName)
    setAdminEmail(entry.contactEmail ?? '')
    setAdminName(entry.contactName ?? '')
    setTempPassword(generatePassword())
    setSelectedFlags(new Set())
    setProvisionedResult(null)
  }

  function closeDialog() {
    setProvisioningEntry(null)
    setProvisionedResult(null)
  }

  function toggleFlag(id: string) {
    setSelectedFlags((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleProvision(e: React.FormEvent) {
    e.preventDefault()
    if (!provisioningEntry) return

    setSaving(true)
    try {
      const res = await fetch(`/api/super/pipeline/${provisioningEntry.id}/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surgeryName,
          adminEmail,
          adminName,
          temporaryPassword: tempPassword,
          featureFlagIds: Array.from(selectedFlags),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Provisioning failed')
        return
      }

      // Update the pipeline entry in parent state
      setEntries((prev) =>
        prev.map((p) =>
          p.id === provisioningEntry.id
            ? {
                ...p,
                linkedSurgeryId: data.surgeryId,
                linkedSurgery: { id: data.surgeryId, name: surgeryName, slug: null },
              }
            : p
        )
      )

      setProvisionedResult({ surgeryId: data.surgeryId })
      toast.success('Surgery provisioned successfully')
    } catch {
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  function copyPassword() {
    navigator.clipboard.writeText(tempPassword)
    toast.success('Password copied to clipboard')
  }

  return (
    <>
      {unprovisionedEntries.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500">
            No contracted practices awaiting provisioning.
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Practices must be at &ldquo;Contracted&rdquo; status to appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Practice Name', 'PCN', 'Contact', 'Contract Start', ''].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {unprovisionedEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {entry.practiceName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {entry.pcnName || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {entry.contactName || '—'}
                    {entry.contactEmail && (
                      <span className="text-gray-400 ml-1">({entry.contactEmail})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {entry.dateContractStart
                      ? new Date(entry.dateContractStart).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <Button size="sm" onClick={() => openProvision(entry)}>
                      Provision
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Already-provisioned contracted entries */}
      {entries.some((e) => e.status === 'Contracted' && e.linkedSurgeryId) && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Already Provisioned</h3>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Practice Name', 'Status', 'Surgery Link'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries
                  .filter((e) => e.status === 'Contracted' && e.linkedSurgeryId)
                  .map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {entry.practiceName}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color="nhs-green" size="sm">Provisioned</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Link
                          href={`/s/${entry.linkedSurgeryId}/admin`}
                          className="text-nhs-blue hover:text-nhs-dark-blue font-medium"
                        >
                          Open Surgery Admin &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Provision Dialog */}
      <Dialog
        open={!!provisioningEntry}
        onClose={closeDialog}
        title={
          provisionedResult
            ? 'Surgery Provisioned'
            : `Provision: ${provisioningEntry?.practiceName ?? ''}`
        }
        width="lg"
        footer={
          provisionedResult ? (
            <Button onClick={closeDialog}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" form="provision-form" loading={saving}>
                {saving ? 'Provisioning...' : 'Provision Surgery'}
              </Button>
            </>
          )
        }
      >
        {provisionedResult ? (
          <div className="space-y-4">
            <AlertBanner variant="success">
              Surgery has been created and the admin account is ready.
            </AlertBanner>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <p><span className="font-medium text-gray-700">Surgery:</span> {surgeryName}</p>
              <p><span className="font-medium text-gray-700">Admin Email:</span> {adminEmail}</p>
              <p><span className="font-medium text-gray-700">Admin Name:</span> {adminName}</p>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700">Temporary Password:</span>
                <code className="bg-white border border-gray-200 px-2 py-0.5 rounded text-sm font-mono">
                  {tempPassword}
                </code>
                <Button variant="ghost" size="sm" onClick={copyPassword}>
                  Copy
                </Button>
              </div>
            </div>

            <Link
              href={`/s/${provisionedResult.surgeryId}/admin`}
              className="inline-flex items-center text-sm font-medium text-nhs-blue hover:text-nhs-dark-blue"
            >
              Open Surgery Admin &rarr;
            </Link>
          </div>
        ) : (
          <form id="provision-form" onSubmit={handleProvision}>
            <div className="space-y-0">
              <FormField label="Surgery Name" required>
                <Input
                  value={surgeryName}
                  onChange={(e) => setSurgeryName(e.target.value)}
                  required
                />
              </FormField>

              <FormField label="Admin Email" required>
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                />
              </FormField>

              <FormField label="Admin Name" required>
                <Input
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                />
              </FormField>

              <FormField label="Temporary Password">
                <div className="flex items-center gap-2">
                  <Input value={tempPassword} readOnly className="font-mono flex-1" />
                  <Button type="button" variant="secondary" size="sm" onClick={copyPassword}>
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTempPassword(generatePassword())}
                  >
                    Regenerate
                  </Button>
                </div>
              </FormField>

              {features.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-nhs-grey mb-2">Feature Flags</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {features.map((f) => (
                      <label
                        key={f.id}
                        className="flex items-start gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFlags.has(f.id)}
                          onChange={() => toggleFlag(f.id)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-nhs-blue focus:ring-nhs-blue"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-700">{f.name}</span>
                          {f.description && (
                            <p className="text-xs text-gray-500">{f.description}</p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </form>
        )}
      </Dialog>
    </>
  )
}
