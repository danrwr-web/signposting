'use client'

import type { CSSProperties } from 'react'

interface AppointmentType {
  id: string
  name: string
  staffType: string | null
  durationMins: number | null
  colour: string | null
  notes: string | null
  isEnabled: boolean
}

interface AppointmentCardProps {
  appointment: AppointmentType
  isAdmin: boolean
  onEdit: (appointment: AppointmentType) => void
  onDelete?: (appointment: AppointmentType) => void
}

interface StaffColour {
  backgroundClass: string
  borderClass: string
  customStyle?: CSSProperties
}

function resolveCustomColour(defaultColour: string): StaffColour {
  if (defaultColour.startsWith('#')) {
    return {
      backgroundClass: 'bg-white',
      borderClass: 'border-nhs-light-grey',
      customStyle: { backgroundColor: defaultColour }
    }
  }

  if (defaultColour.startsWith('bg-')) {
    return {
      backgroundClass: defaultColour,
      borderClass: 'border-nhs-light-grey'
    }
  }

  return {
    backgroundClass: 'bg-nhs-light-grey',
    borderClass: 'border-nhs-light-grey'
  }
}

function getStaffColour(staffType: string | null, defaultColour: string | null): StaffColour {
  if (defaultColour) {
    return resolveCustomColour(defaultColour)
  }

  if (!staffType) {
    return {
      backgroundClass: 'bg-nhs-light-grey',
      borderClass: 'border-nhs-light-grey'
    }
  }

  const normalized = staffType.trim().toLowerCase()

  if (normalized === 'pn' || normalized.includes('pn')) {
    return {
      backgroundClass: 'bg-nhs-green-tint',
      borderClass: 'border-nhs-green'
    }
  }

  if (normalized === 'hca' || normalized.includes('hca')) {
    return {
      backgroundClass: 'bg-nhs-red-tint',
      borderClass: 'border-nhs-red'
    }
  }

  if (normalized.includes('dr') || normalized.includes('doctor')) {
    return {
      backgroundClass: 'bg-nhs-light-blue',
      borderClass: 'border-nhs-blue'
    }
  }

  if (normalized === 'all') {
    return {
      backgroundClass: 'bg-nhs-yellow-tint',
      borderClass: 'border-nhs-yellow'
    }
  }

  return {
    backgroundClass: 'bg-nhs-light-grey',
    borderClass: 'border-nhs-light-grey'
  }
}

export default function AppointmentCard({ appointment, isAdmin, onEdit, onDelete }: AppointmentCardProps) {
  const { backgroundClass, borderClass, customStyle } = getStaffColour(
    appointment.staffType,
    appointment.colour
  )

  return (
    <div
      className={`flex h-full flex-col rounded-lg border-2 ${borderClass} ${backgroundClass} p-4 shadow-md`}
      style={customStyle}
    >
      {/* Header with title and admin actions */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="flex-1 pr-2 text-base font-semibold text-gray-900">
          {appointment.name}
        </h3>
        {isAdmin && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onEdit(appointment)}
              className="text-nhs-grey transition-colors hover:text-nhs-dark-grey focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              aria-label="Edit appointment"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(appointment)}
                className="text-nhs-red transition-colors hover:text-nhs-red-dark focus:outline-none focus:ring-2 focus:ring-nhs-blue"
                aria-label="Delete appointment"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Duration */}
      {appointment.durationMins && (
        <div className="mb-2 text-sm text-nhs-grey">
          {appointment.durationMins} mins
        </div>
      )}

      {/* Staff Type Badge */}
      {appointment.staffType && (
        <div className="mb-2">
          <span className="inline-block rounded-full bg-white/80 px-2 py-1 text-xs font-medium text-nhs-grey">
            {appointment.staffType}
          </span>
        </div>
      )}

      {/* Notes */}
      {appointment.notes && (
        <div className="mt-auto border-t border-nhs-light-grey pt-2 text-sm text-nhs-grey">
          {appointment.notes}
        </div>
      )}
    </div>
  )
}

