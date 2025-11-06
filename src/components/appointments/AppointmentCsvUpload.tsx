'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

interface AppointmentCsvUploadProps {
  surgeryId: string
  onSuccess: () => void
  onCancel: () => void
}

export default function AppointmentCsvUpload({ 
  surgeryId, 
  onSuccess,
  onCancel 
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

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed')
      }

      toast.success(`Imported ${result.total} appointments (${result.created} created, ${result.updated} updated)`)
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
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select CSV File
        </label>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-nhs-blue file:text-white hover:file:bg-blue-700"
          disabled={uploading}
        />
      </div>
      
      <div className="text-sm text-gray-600 mb-4">
        <p className="mb-2">CSV should have columns:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Appointment Name</li>
          <li>Duration</li>
          <li>Personnel</li>
          <li>AppointmentType</li>
          <li>Notes</li>
        </ul>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          disabled={uploading}
        >
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="px-4 py-2 bg-nhs-blue text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </div>
  )
}

