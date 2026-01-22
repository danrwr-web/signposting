'use client'

import { useId, useState } from 'react'
import AdminToolkitAttachmentsClient from './AdminToolkitAttachmentsClient'

type Attachment = {
  id: string
  label: string
  url: string
}

interface AdminToolkitAttachmentsSectionClientProps {
  surgeryId: string
  itemId: string
  canEditThisItem: boolean
  attachments: Attachment[]
  defaultOpen?: boolean
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

export default function AdminToolkitAttachmentsSectionClient({
  surgeryId,
  itemId,
  canEditThisItem,
  attachments,
  defaultOpen,
}: AdminToolkitAttachmentsSectionClientProps) {
  const count = attachments.length
  const contentId = useId()
  const [open, setOpen] = useState<boolean>(defaultOpen ?? count > 0)

  return (
    <section className="mt-6 bg-white rounded-lg shadow-md p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-nhs-dark-blue">
            Attachments <span className="text-sm font-normal text-nhs-grey">({count})</span>
          </h2>
          {open ? (
            <p className="mt-1 text-sm text-nhs-grey">
              {canEditThisItem
                ? 'Add PDFs, Word documents, images, or folder links to support this page.'
                : 'Links and documents attached to this page.'}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm font-medium text-nhs-blue hover:text-nhs-dark-blue underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2 rounded"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{open ? 'Hide attachments' : 'Show attachments'}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open ? (
        <div id={contentId} className="mt-4">
          <AdminToolkitAttachmentsClient
            surgeryId={surgeryId}
            itemId={itemId}
            canEditThisItem={canEditThisItem}
            attachments={attachments}
          />
        </div>
      ) : null}
    </section>
  )
}

