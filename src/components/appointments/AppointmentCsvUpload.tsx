'use client'

import { RefObject, useState } from 'react'
import toast from 'react-hot-toast'

interface AppointmentCsvUploadProps {
  surgeryId: string
  onSuccess: () => void
  onCancel: () => void
  inputRef?: RefObject<HTMLInputElement>
}

export default function AppointmentCsvUpload({ 
  surgeryId, 
  onSuccess,
  onCancel,
  inputRef
}: AppointmentCsvUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Please select a CSV file')
        return
      }
      setFile(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('surgeryId', surgeryId)

      const response = await fetch('/api/admin/appointments/import', {
        method: 'POST',
        body: formData
      })

      const result = await response.json() as {
        created?: number
        updated?: number
        total?: number
        skipped?: number
        issues?: Array<{ row: number; reason: string }>
        error?: string
      }

      if (!response.ok) {
        const message = result?.error ?? 'Upload failed'
        const issueDetails = result?.issues?.slice(0, 3).map((issue) => `row ${issue.row}: ${issue.reason}`).join('; ')
        toast.error(issueDetails ? `${message}. ${issueDetails}` : message)
        return
      }

      const summaryParts = [
        `${result.total ?? 0} appointments`,
        `${result.created ?? 0} created`,
        `${result.updated ?? 0} updated`
      ]

      let summary = `Imported ${summaryParts[0]} (${summaryParts.slice(1).join(', ')})`
      if (result.skipped) {
        summary += `. Skipped ${result.skipped} row${result.skipped === 1 ? '' : 's'}.`
      }

      toast.success(summary)

      if (result.skipped && result.issues?.length) {
        const details = result.issues
          .slice(0, 3)
          .map((issue) => `Row ${issue.row}: ${issue.reason}`)
          .join(' • ')
        toast(() => (
          <span className="text-sm text-nhs-grey">
            Some rows were skipped: {details}
            {result.issues.length > 3 ? '…' : ''}
          </span>
        ), { icon: '⚠️' })
      }
      onSuccess()
    } catch (error) {
      console.error('Error uploading CSV:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload CSV')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-nhs-grey">
          Select CSV file
        </label>
        <input
          type="file"
          accept=".csv"
          ref={inputRef}
          onChange={handleFileChange}
          className="block w-full text-sm text-nhs-grey file:mr-4 file:rounded-md file:border-0 file:bg-nhs-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue"
          disabled={uploading}
        />
      </div>
      
      <div className="mb-4 text-sm text-nhs-grey">
        <p className="mb-2">CSV should have columns:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Appointment Name</li>
          <li>Duration</li>
          <li>Personnel</li>
          <li>AppointmentType</li>
          <li>Notes</li>
        </ul>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-nhs-light-grey px-4 py-2 text-nhs-grey transition-colors hover:bg-nhs-light-grey focus:outline-none focus:ring-2 focus:ring-nhs-blue"
          disabled={uploading}
        >
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="rounded-md bg-nhs-blue px-4 py-2 text-white transition-colors hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </div>
  )
}

