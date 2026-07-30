'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { addAdminToolkitAttachmentFile, addAdminToolkitAttachmentLink, removeAdminToolkitAttachment } from '../actions'

interface Attachment {
  id: string
  label: string
  url: string
}

interface AdminToolkitAttachmentsClientProps {
  surgeryId: string
  itemId: string
  canEditThisItem: boolean
  attachments: Attachment[]
}

const UPLOADED_FILE_URL_PREFIX = '/api/admin-toolkit/files/'
const MAX_PDF_BYTES = 4 * 1024 * 1024 // Keep in sync with the upload route.

export default function AdminToolkitAttachmentsClient({
  surgeryId,
  itemId,
  canEditThisItem,
  attachments,
}: AdminToolkitAttachmentsClientProps) {
  const router = useRouter()
  const [mode, setMode] = useState<'link' | 'pdf'>('link')
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sorted = useMemo(() => attachments.slice().sort((a, b) => a.label.localeCompare(b.label)), [attachments])
  const hasAttachments = sorted.length > 0

  const resetForm = () => {
    setLabel('')
    setUrl('')
    setPdfFile(null)
    setPdfError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onPickPdf = (picked: File | null) => {
    setPdfError(null)
    if (!picked) {
      setPdfFile(null)
      return
    }
    if (picked.type !== 'application/pdf') {
      setPdfFile(null)
      setPdfError('Only PDF documents are supported.')
      return
    }
    if (picked.size > MAX_PDF_BYTES) {
      setPdfFile(null)
      setPdfError('PDF must be 4MB or smaller.')
      return
    }
    setPdfFile(picked)
    // Pre-fill the label from the filename if the editor hasn't typed one.
    if (!label.trim()) {
      setLabel(picked.name.replace(/\.pdf$/i, ''))
    }
  }

  const submit = async () => {
    setSaving(true)
    try {
      if (mode === 'link') {
        const res = await addAdminToolkitAttachmentLink({ surgeryId, itemId, label, url })
        if (!res.ok) {
          toast.error(res.error.message)
          return
        }
      } else {
        if (!pdfFile) return
        const formData = new FormData()
        formData.append('file', pdfFile)
        formData.append('surgeryId', surgeryId)
        formData.append('itemId', itemId)
        const uploadRes = await fetch('/api/admin-toolkit/files', { method: 'POST', body: formData })
        const body = (await uploadRes.json().catch(() => null)) as { id?: string; error?: string } | null
        if (!uploadRes.ok || !body?.id) {
          toast.error(body?.error || 'Failed to upload PDF. Please try again.')
          return
        }
        const res = await addAdminToolkitAttachmentFile({ surgeryId, itemId, label, fileId: body.id })
        if (!res.ok) {
          toast.error(res.error.message)
          return
        }
      }
      toast.success('Attachment added')
      resetForm()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = mode === 'link' ? !!label.trim() && !!url.trim() : !!label.trim() && !!pdfFile

  return (
    <div>
      {!hasAttachments ? (
        canEditThisItem ? (
          <p className="text-sm text-gray-700">
            No attachments yet. You can upload PDFs, or add links to Word documents, images, or folders to support this page.
          </p>
        ) : (
          <div className="text-sm text-gray-700">
            <p>There are no attachments for this page.</p>
            <p className="mt-2">If you think something should be added, please speak to an administrator.</p>
          </div>
        )
      ) : (
        <ul className="space-y-2">
          {sorted.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{a.label}</div>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm text-nhs-blue hover:underline break-all"
                >
                  {a.url.startsWith(UPLOADED_FILE_URL_PREFIX) ? 'Uploaded PDF' : a.url}
                </a>
              </div>
              {canEditThisItem ? (
                <button
                  type="button"
                  className="text-sm text-red-700 hover:text-red-800"
                  onClick={async () => {
                    const ok = confirm('Remove this attachment?')
                    if (!ok) return
                    const res = await removeAdminToolkitAttachment({ surgeryId, itemId, attachmentId: a.id })
                    if (!res.ok) {
                      toast.error(res.error.message)
                      return
                    }
                    toast.success('Attachment removed')
                    router.refresh()
                  }}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEditThisItem ? (
        <form
          className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
          onSubmit={async (e) => {
            e.preventDefault()
            await submit()
          }}
        >
          <fieldset className="mb-3">
            <legend className="sr-only">Attachment type</legend>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="radio"
                  name="attachment-type"
                  checked={mode === 'link'}
                  onChange={() => setMode('link')}
                />
                Link
              </label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="radio"
                  name="attachment-type"
                  checked={mode === 'pdf'}
                  onChange={() => setMode('pdf')}
                />
                Upload PDF
              </label>
            </div>
          </fieldset>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full nhs-input"
                placeholder="e.g. Duty rota SOP (PDF)"
              />
            </div>
            {mode === 'link' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link</label>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full nhs-input"
                  placeholder="https://…"
                  inputMode="url"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PDF file (max 4MB)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => onPickPdf(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-700 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
                />
                {pdfError ? <p className="mt-1 text-xs text-red-600">{pdfError}</p> : null}
              </div>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <button type="submit" className="nhs-button" disabled={saving || !canSubmit}>
              {saving ? 'Saving…' : mode === 'link' ? 'Add link' : 'Upload and attach'}
            </button>
          </div>
        </form>
      ) : hasAttachments ? (
        <p className="mt-3 text-sm text-gray-500">If you need to change attachments, please speak to an administrator.</p>
      ) : null}
    </div>
  )
}
