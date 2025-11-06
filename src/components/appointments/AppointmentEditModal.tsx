'use client'

import { useState, useEffect } from 'react'

interface AppointmentType {
  id: string
  name: string
  staffType: string | null
  durationMins: number | null
  colour: string | null
  notes: string | null
  isEnabled: boolean
}

interface AppointmentEditModalProps {
  appointment: AppointmentType | null
  surgeryId: string
  onSave: (data: Partial<AppointmentType>) => void
  onCancel: () => void
}

export default function AppointmentEditModal({
  appointment,
  surgeryId,
  onSave,
  onCancel
}: AppointmentEditModalProps) {
  const [name, setName] = useState('')
  const [staffType, setStaffType] = useState<string>('All')
  const [durationMins, setDurationMins] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [colour, setColour] = useState('')

  useEffect(() => {
    if (appointment) {
      setName(appointment.name)
      setStaffType(appointment.staffType || 'All')
      setDurationMins(appointment.durationMins?.toString() || '')
      setNotes(appointment.notes || '')
      setColour(appointment.colour || '')
    } else {
      setName('')
      setStaffType('All')
      setDurationMins('')
      setNotes('')
      setColour('')
    }
  }, [appointment])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const data: Partial<AppointmentType> = {
      name,
      staffType: staffType || null,
      durationMins: durationMins ? parseInt(durationMins, 10) : null,
      notes: notes || null,
      colour: colour || null
    }

    onSave(data)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {appointment ? 'Edit Appointment' : 'Add New Appointment'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Appointment Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nhs-blue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Staff Type
            </label>
            <select
              value={staffType}
              onChange={(e) => setStaffType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nhs-blue"
            >
              <option value="All">All</option>
              <option value="PN">PN</option>
              <option value="HCA">HCA</option>
              <option value="Dr">Dr</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={durationMins}
              onChange={(e) => setDurationMins(e.target.value)}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nhs-blue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Colour (hex or Tailwind class)
            </label>
            <input
              type="text"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              placeholder="e.g., #FF0000 or bg-red-100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nhs-blue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nhs-blue"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-nhs-blue text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {appointment ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

