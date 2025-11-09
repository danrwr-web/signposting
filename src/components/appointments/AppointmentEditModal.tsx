'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

const STAFF_TYPE_DEFAULT_COLOURS: Record<string, string> = {
  ALL: 'bg-nhs-yellow-tint',
  PN: 'bg-nhs-green-tint',
  HCA: 'bg-nhs-red-tint',
  DR: 'bg-nhs-light-blue'
}

const COLOUR_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'NHS Green', value: 'bg-nhs-green-tint' },
  { label: 'NHS Red', value: 'bg-nhs-red-tint' },
  { label: 'NHS Light Blue', value: 'bg-nhs-light-blue' },
  { label: 'NHS Yellow', value: 'bg-nhs-yellow-tint' },
  { label: 'NHS Dark Blue', value: 'bg-nhs-dark-blue' },
  { label: 'NHS Grey', value: 'bg-nhs-light-grey' },
  { label: 'White', value: '#ffffff' },
  { label: 'Charcoal', value: '#2F3133' }
]

function getDefaultColourForStaff(staffType: string | null | undefined): string {
  if (!staffType) {
    return STAFF_TYPE_DEFAULT_COLOURS.ALL
  }
  const key = staffType.trim().toUpperCase()
  return STAFF_TYPE_DEFAULT_COLOURS[key] ?? STAFF_TYPE_DEFAULT_COLOURS.ALL
}

function isHexColour(value: string): boolean {
  return value.startsWith('#')
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
  const [hasCustomColour, setHasCustomColour] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (appointment) {
      const initialStaffType = appointment.staffType || 'All'
      const defaultColour = getDefaultColourForStaff(initialStaffType)

      setName(appointment.name)
      setStaffType(initialStaffType)
      setDurationMins(appointment.durationMins?.toString() || '')
      setNotes(appointment.notes || '')
      setColour(appointment.colour || defaultColour)
      setHasCustomColour(
        Boolean(appointment.colour && appointment.colour.trim() && appointment.colour !== defaultColour)
      )
    } else {
      const defaultStaffType = 'All'
      const defaultColour = getDefaultColourForStaff(defaultStaffType)

      setName('')
      setStaffType(defaultStaffType)
      setDurationMins('')
      setNotes('')
      setColour(defaultColour)
      setHasCustomColour(false)
    }
  }, [appointment])

  useEffect(() => {
    if (!hasCustomColour) {
      const defaultColour = getDefaultColourForStaff(staffType)
      setColour(defaultColour)
    }
  }, [staffType, hasCustomColour])

  const defaultColour = useMemo(
    () => getDefaultColourForStaff(staffType),
    [staffType]
  )

  const effectiveColour = hasCustomColour
    ? colour || defaultColour
    : defaultColour

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedColour = colour.trim()
    const colourToPersist = hasCustomColour
      ? trimmedColour || null
      : null

    const data: Partial<AppointmentType> = {
      name,
      staffType: staffType || null,
      durationMins: durationMins ? parseInt(durationMins, 10) : null,
      notes: notes || null,
      colour: colourToPersist
    }

    onSave(data)
  }

  const handleColourInputChange = (value: string) => {
    setColour(value)
    const trimmed = value.trim()
    if (!trimmed) {
      setHasCustomColour(false)
      return
    }
    setHasCustomColour(trimmed !== defaultColour)
  }

  const handlePaletteSelect = (value: string) => {
    setColour(value)
    setHasCustomColour(value !== defaultColour)
  }

  const handleResetColour = () => {
    setColour(defaultColour)
    setHasCustomColour(false)
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
          <label className="mb-1 block text-sm font-medium text-nhs-grey">
            Colour
          </label>
          <p className="text-xs text-nhs-grey">
            The default colour changes with the staff team. Choose another shade or enter a custom value.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-md border border-nhs-light-grey ${isHexColour(effectiveColour) ? '' : effectiveColour}`}
              style={isHexColour(effectiveColour) ? { backgroundColor: effectiveColour } : undefined}
              aria-hidden="true"
            />
            <div className="text-xs text-nhs-grey">
              {hasCustomColour ? 'Custom colour selected.' : 'Using the default colour for this staff team.'}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {COLOUR_PRESETS.map((option) => {
              const isSelected =
                (hasCustomColour && option.value === colour) ||
                (!hasCustomColour && option.value === defaultColour)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handlePaletteSelect(option.value)}
                  className={`flex h-10 w-full items-center justify-center rounded-md border ${isSelected ? 'ring-2 ring-nhs-blue border-transparent' : 'border-nhs-light-grey'} ${isHexColour(option.value) ? '' : option.value}`}
                  style={isHexColour(option.value) ? { backgroundColor: option.value } : undefined}
                  title={option.label}
                >
                  <span className="sr-only">{option.label}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <label
              htmlFor="appointment-colour"
              className="text-sm font-medium text-nhs-grey"
            >
              Custom colour (hex code or Tailwind token)
            </label>
            <input
              id="appointment-colour"
              type="text"
              value={colour}
              onChange={(event) => handleColourInputChange(event.target.value)}
              placeholder="e.g. bg-nhs-green-tint or #00A499"
              className="w-full rounded-md border border-nhs-light-grey px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nhs-blue"
            />
            <button
              type="button"
              onClick={handleResetColour}
              className="self-start text-sm text-nhs-blue hover:text-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue rounded-md px-2 py-1"
            >
              Use default colour
            </button>
          </div>
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

