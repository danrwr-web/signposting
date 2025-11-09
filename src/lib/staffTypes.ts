export const normalizeStaffLabel = (value: string): string => {
  if (!value) {
    return 'STAFF'
  }
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_') || 'STAFF'
}

export interface StaffTypeResponse {
  id: string
  label: string
  normalizedLabel: string
  defaultColour: string | null
  isBuiltIn: boolean
  isEnabled: boolean
  orderIndex: number
  surgeryId: string | null
}

