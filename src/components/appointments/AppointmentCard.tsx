'use client'

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
}

// Get colour for staff type - very pale colors
function getStaffColour(staffType: string | null, defaultColour: string | null): string {
  if (defaultColour) {
    // If custom colour is provided, use it but ensure it's pale
    return defaultColour
  }
  
  if (!staffType) {
    return 'bg-yellow-50 border-yellow-200'
  }

  const normalized = staffType.trim()
  if (normalized === 'PN' || normalized.includes('PN')) {
    return 'bg-green-50 border-green-200'
  }
  if (normalized === 'HCA' || normalized.includes('HCA')) {
    return 'bg-red-50 border-red-200'
  }
  if (normalized.includes('Dr') || normalized.includes('Doctor')) {
    return 'bg-blue-50 border-blue-200'
  }
  if (normalized === 'All') {
    return 'bg-yellow-50 border-yellow-200'
  }
  
  return 'bg-gray-50 border-gray-200'
}

export default function AppointmentCard({ appointment, isAdmin, onEdit }: AppointmentCardProps) {
  const cardColour = getStaffColour(appointment.staffType, appointment.colour)

  return (
    <div className={`rounded-lg shadow-md p-4 border-2 ${cardColour} h-full flex flex-col`}>
      {/* Header with title and edit button */}
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-base font-semibold text-gray-900 flex-1 pr-2">
          {appointment.name}
        </h3>
        {isAdmin && (
          <button
            onClick={() => onEdit(appointment)}
            className="text-gray-600 hover:text-gray-900 transition-colors"
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
        )}
      </div>

      {/* Duration */}
      {appointment.durationMins && (
        <div className="text-sm text-gray-600 mb-2">
          {appointment.durationMins} mins
        </div>
      )}

      {/* Staff Type Badge */}
      {appointment.staffType && (
        <div className="mb-2">
          <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-white bg-opacity-70 text-gray-700">
            {appointment.staffType}
          </span>
        </div>
      )}

      {/* Notes */}
      {appointment.notes && (
        <div className="text-sm text-gray-700 mt-auto pt-2 border-t border-gray-300">
          {appointment.notes}
        </div>
      )}
    </div>
  )
}

