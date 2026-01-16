'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { addAdminToolkitAttachmentLink, removeAdminToolkitAttachment } from '../actions'

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

export default function AdminToolkitAttachmentsClient({
  surgeryId,
  itemId,
  canEditThisItem,
  attachments,
}: AdminToolkitAttachmentsClientProps) {
  const router = useRouter()
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const sorted = useMemo(() => attachments.slice().sort((a, b) => a.label.localeCompare(b.label)), [attachments])

  return (
    <div>
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500">No attachments yet.</p>
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
                  {a.url}
                </a>
              </div>
              {canEditThisItem ? (
                <button
                  type="button"
                  className="text-sm text-red-700 hover:text-red-800"
                  onClick={async () => {
                    const ok = confirm('Remove this attachment link?')
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
            setSaving(true)
            try {
              const res = await addAdminToolkitAttachmentLink({ surgeryId, itemId, label, url })
              if (!res.ok) {
                toast.error(res.error.message)
                return
              }
              toast.success('Attachment added')
              setLabel('')
              setUrl('')
              router.refresh()
            } finally {
              setSaving(false)
            }
          }}
        >
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
          </div>
          <div className="mt-3 flex justify-end">
            <button type="submit" className="nhs-button" disabled={saving || !label.trim() || !url.trim()}>
              {saving ? 'Saving…' : 'Add link'}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-sm text-gray-500">You cannot edit attachments for this item.</p>
      )}
    </div>
  )
}

