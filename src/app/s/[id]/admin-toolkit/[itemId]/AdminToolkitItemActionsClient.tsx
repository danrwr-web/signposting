'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '@/components/appointments/Modal'
import { deleteAdminToolkitItem } from '../actions'

interface AdminToolkitItemActionsClientProps {
  surgeryId: string
  itemId: string
  canManage: boolean
  canEditThisItem: boolean
}

export default function AdminToolkitItemActionsClient({
  surgeryId,
  itemId,
  canManage,
  canEditThisItem,
}: AdminToolkitItemActionsClientProps) {
  const router = useRouter()
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!canManage && !canEditThisItem) {
    return <span className="text-sm text-gray-500">View only</span>
  }

  return (
    <div className="flex items-center gap-3">
      {canManage ? (
        <Link
          href={`/s/${surgeryId}/admin-toolkit/admin?item=${encodeURIComponent(itemId)}`}
          className="text-sm font-medium text-nhs-blue hover:text-nhs-dark-blue underline-offset-2 hover:underline"
        >
          Manage
        </Link>
      ) : null}

      {canEditThisItem ? (
        <Link
          href={`/s/${surgeryId}/admin-toolkit/item/${encodeURIComponent(itemId)}/edit`}
          className="text-sm font-medium text-nhs-blue hover:text-nhs-dark-blue underline-offset-2 hover:underline"
        >
          Edit
        </Link>
      ) : null}

      {canManage ? (
        <button
          type="button"
          onClick={() => setShowDelete(true)}
          className="text-sm font-medium text-red-700 hover:text-red-800 underline-offset-2 hover:underline"
        >
          Delete
        </button>
      ) : null}

      {showDelete && (
        <Modal
          title="Delete page"
          description="This hides the page from the library. You can restore it later (superuser only)."
          onClose={() => setShowDelete(false)}
          widthClassName="max-w-lg"
        >
          <p className="text-sm text-nhs-grey">
            Are you sure you want to delete this page? Staff will no longer be able to find it.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              onClick={() => setShowDelete(false)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-nhs-red px-4 py-2 text-white transition-colors hover:bg-nhs-red-dark focus:outline-none focus:ring-2 focus:ring-nhs-red disabled:opacity-70"
              onClick={async () => {
                setDeleting(true)
                try {
                  const res = await deleteAdminToolkitItem({ surgeryId, itemId })
                  if (!res.ok) {
                    toast.error(res.error.message)
                    return
                  }
                  toast.success('Page deleted')
                  router.push(`/s/${surgeryId}/admin-toolkit`)
                  router.refresh()
                } finally {
                  setDeleting(false)
                }
              }}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

