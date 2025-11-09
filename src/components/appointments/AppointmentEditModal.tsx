'use client'

import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'

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
  onSave: (data: Partial<AppointmentType>) => void
  onCancel: () => void
}

export default function AppointmentEditModal({
  appointment,
  onSave,
  onCancel
}: AppointmentEditModalProps) {
  const [name, setName] = useState('')
  const [staffType, setStaffType] = useState<string>('All')
  const [durationMins, setDurationMins] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [colour, setColour] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const data: Partial<AppointmentType> = {
      name,
      staffType: staffType || null,
      durationMins: durationMins ? parseInt(durationMins, 10) : null,
      notes: notes || null,
      colour: colour || null
    }

    onSave(data)
  }

  const modalTitle = appointment ? 'Edit appointment' : 'Add new appointment'

  return (
    <Modal
      title={modalTitle}
      onClose={onCancel}
      initialFocusRef={nameInputRef}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="appointment-name"
            className="mb-1 block text-sm font-medium text-nhs-grey"
          >
            Appointment name<span className="text-nhs-red"> *</span>
          </label>
          <input
            ref={nameInputRef}
            id="appointment-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="w-full rounded-md border border-nhs-light-grey px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nhs-blue"
          />
        </div>

        <div>
          <label
            htmlFor="appointment-staff"
            className="mb-1 block text-sm font-medium text-nhs-grey"
          >
            Staff team
          </label>
          <select
            id="appointment-staff"
            value={staffType}
            onChange={(event) => setStaffType(event.target.value)}
            className="w-full rounded-md border border-nhs-light-grey px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nhs-blue"
          >
            <option value="All">All</option>
            <option value="PN">PN</option>
            <option value="HCA">HCA</option>
            <option value="Dr">Dr</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="appointment-duration"
            className="mb-1 block text-sm font-medium text-nhs-grey"
          >
            Duration (minutes)
          </label>
          <input
            id="appointment-duration"
            type="number"
            value={durationMins}
            onChange={(event) => setDurationMins(event.target.value)}
            min={1}
            className="w-full rounded-md border border-nhs-light-grey px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nhs-blue"
          />
        </div>

        <div>
          <label
            htmlFor="appointment-colour"
            className="mb-1 block text-sm font-medium text-nhs-grey"
          >
            Colour (hex or Tailwind token)
          </label>
          <input
            id="appointment-colour"
            type="text"
            value={colour}
            onChange={(event) => setColour(event.target.value)}
            placeholder="e.g. bg-nhs-green-tint or #00A499"
            className="w-full rounded-md border border-nhs-light-grey px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nhs-blue"
          />
        </div>

        <div>
          <label
            htmlFor="appointment-notes"
            className="mb-1 block text-sm font-medium text-nhs-grey"
          >
            Notes
          </label>
          <textarea
            id="appointment-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-nhs-light-grey px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nhs-blue"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-nhs-light-grey px-4 py-2 text-nhs-grey transition-colors hover:bg-nhs-light-grey focus:outline-none focus:ring-2 focus:ring-nhs-blue"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-nhs-blue px-4 py-2 text-white transition-colors hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue"
          >
            {appointment ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

