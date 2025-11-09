'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import Modal from './Modal'
import { StaffTypeResponse } from '@/lib/staffTypes'

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

const DEFAULT_COLOUR = 'bg-nhs-yellow-tint'

interface StaffTypesManagerProps {
  surgeryId: string
  staffTypes: StaffTypeResponse[]
  onClose: () => void
  onUpdated: () => void
}

export default function StaffTypesManager({
  surgeryId,
  staffTypes,
  onClose,
  onUpdated
}: StaffTypesManagerProps) {
  const [label, setLabel] = useState('')
  const [colour, setColour] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const customStaffTypes = useMemo(
    () => staffTypes.filter((type) => type.surgeryId === surgeryId),
    [staffTypes, surgeryId]
  )

  const builtInStaffTypes = useMemo(
    () => staffTypes.filter((type) => type.surgeryId === null),
    [staffTypes]
  )

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!label.trim()) {
      toast.error('Enter a staff team name')
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/admin/appointments/staff-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surgeryId,
          label: label.trim(),
          defaultColour: colour || undefined
        })
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to create staff team')
      }
      toast.success('Staff team added')
      setLabel('')
      setColour(null)
      onUpdated()
    } catch (error) {
      console.error('Error creating staff type:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create staff team')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateColour = async (id: string, value: string) => {
    setUpdatingId(id)
    try {
      const response = await fetch(`/api/admin/appointments/staff-types/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultColour: value })
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to update colour')
      }
      toast.success('Colour updated')
      onUpdated()
    } catch (error) {
      console.error('Error updating staff type:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update colour')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove staff team "${name}"? Appointments using this team will move to All.`)) {
      return
    }
    setUpdatingId(id)
    try {
      const response = await fetch(`/api/admin/appointments/staff-types/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to delete staff team')
      }
      toast.success('Staff team removed')
      onUpdated()
    } catch (error) {
      console.error('Error deleting staff type:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete staff team')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Modal
      title="Manage staff teams"
      description="Create custom teams for your surgery and set their default colours."
      onClose={onClose}
    >
      <section className="space-y-6">
        <form onSubmit={handleCreate} className="space-y-4 rounded-lg border border-nhs-light-grey p-4">
          <h3 className="text-sm font-semibold text-nhs-dark-blue">Add a new staff team</h3>
          <div>
            <label className="mb-1 block text-sm font-medium text-nhs-grey" htmlFor="staff-label">
              Team name
            </label>
            <input
              id="staff-label"
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="w-full rounded-md border border-nhs-light-grey px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              placeholder="e.g. Paramedic"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-nhs-grey">
              Default colour (optional)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {COLOUR_PRESETS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setColour(option.value)}
                  className={`flex h-10 w-full items-center justify-center rounded-md border ${
                    colour === option.value ? 'ring-2 ring-nhs-blue border-transparent' : 'border-nhs-light-grey'
                  } ${option.value.startsWith('#') ? '' : option.value}`}
                  style={option.value.startsWith('#') ? { backgroundColor: option.value } : undefined}
                  title={option.label}
                >
                  <span className="sr-only">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setColour(null)
                setLabel('')
              }}
              className="rounded-md border border-nhs-light-grey px-3 py-2 text-sm text-nhs-grey hover:bg-nhs-light-grey"
              disabled={saving}
            >
              Clear
            </button>
            <button
              type="submit"
              className="rounded-md bg-nhs-blue px-4 py-2 text-white hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue disabled:opacity-60"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Add team'}
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-nhs-dark-blue">Current teams</h3>
          <div className="space-y-3">
            {[...builtInStaffTypes, ...customStaffTypes].map((type) => {
              const isCustom = type.surgeryId === surgeryId
              const swatchColour = type.defaultColour || DEFAULT_COLOUR
              return (
                <div
                  key={`${type.surgeryId ?? 'global'}-${type.id}`}
                  className="flex items-center justify-between rounded-lg border border-nhs-light-grey px-4 py-3"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-8 w-8 rounded-md border border-nhs-light-grey ${
                        swatchColour.startsWith('#') ? '' : swatchColour
                      }`}
                      style={swatchColour.startsWith('#') ? { backgroundColor: swatchColour } : undefined}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-medium text-nhs-grey">{type.label}</p>
                      <p className="text-xs text-nhs-grey">
                        {isCustom ? 'Surgery-specific team' : 'Built-in team'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCustom && (
                      <div className="flex items-center gap-2">
                        {COLOUR_PRESETS.map((option) => (
                          <button
                            key={`${type.id}-${option.value}`}
                            type="button"
                            onClick={() => handleUpdateColour(type.id, option.value)}
                            className={`h-6 w-6 rounded-full border ${
                              option.value === type.defaultColour
                                ? 'ring-2 ring-nhs-blue border-transparent'
                                : 'border-nhs-light-grey'
                            } ${option.value.startsWith('#') ? '' : option.value}`}
                            style={option.value.startsWith('#') ? { backgroundColor: option.value } : undefined}
                            title={`Set colour to ${option.label}`}
                            disabled={updatingId === type.id}
                          >
                            <span className="sr-only">Set to {option.label}</span>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleDelete(type.id, type.label)}
                          className="rounded-md border border-nhs-red px-3 py-1 text-sm text-nhs-red hover:bg-nhs-red/10 disabled:opacity-60"
                          disabled={updatingId === type.id}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </Modal>
  )
}
