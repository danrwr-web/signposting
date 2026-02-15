'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import AppointmentCsvUpload from '@/components/appointments/AppointmentCsvUpload'
import AppointmentCard from '@/components/appointments/AppointmentCard'
import AppointmentEditModal from '@/components/appointments/AppointmentEditModal'
import StaffTypesManager from '@/components/appointments/StaffTypesManager'
import Modal from '@/components/appointments/Modal'
import { normalizeStaffLabel, StaffTypeResponse } from '@/lib/staffTypes'
import { SkeletonCardGrid } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

interface AppointmentType {
  id: string
  name: string
  staffType: string | null
  durationMins: number | null
  colour: string | null
  notes: string | null
  isEnabled: boolean
}

interface AppointmentsPageClientProps {
  surgeryId: string
  surgeryName: string
  isAdmin: boolean
  initialStaffTypes: StaffTypeResponse[]
}

export default function AppointmentsPageClient({ 
  surgeryId, 
  surgeryName,
  isAdmin,
  initialStaffTypes,
}: AppointmentsPageClientProps) {
  const [appointments, setAppointments] = useState<AppointmentType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [staffTypes, setStaffTypes] = useState<StaffTypeResponse[]>(initialStaffTypes)
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<AppointmentType | null>(null)
  const [appointmentPendingDelete, setAppointmentPendingDelete] = useState<AppointmentType | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showStaffTypesModal, setShowStaffTypesModal] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const deleteCancelButtonRef = useRef<HTMLButtonElement>(null)

  // Fetch appointments
  const fetchAppointments = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/appointments?surgeryId=${surgeryId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch appointments')
      }
      const data = await response.json()
      setAppointments(data)
    } catch (error) {
      console.error('Error fetching appointments:', error)
      toast.error('Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAppointments()
  }, [surgeryId])

  const fetchStaffTypes = async () => {
    try {
      const response = await fetch(`/api/appointments/staff-types?surgeryId=${surgeryId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch staff teams')
      }
      const data = await response.json()
      if (Array.isArray(data.staffTypes)) {
        setStaffTypes(data.staffTypes)
      }
    } catch (error) {
      console.error('Error fetching staff types:', error)
      toast.error('Failed to load staff teams')
    }
  }

  useEffect(() => {
    fetchStaffTypes()
  }, [surgeryId])

  const staffTypeMap = useMemo(() => {
    const map = new Map<string, StaffTypeResponse>()
    staffTypes.forEach((type) => {
      map.set(type.normalizedLabel, type)
    })
    return map
  }, [staffTypes])

  const filterOptions = useMemo(() => {
    const enabledTypes = staffTypes
      .filter((type) => type.isEnabled !== false && type.normalizedLabel !== 'ALL')
      .sort((a, b) => {
        if (a.orderIndex === b.orderIndex) {
          return a.label.localeCompare(b.label)
        }
        return a.orderIndex - b.orderIndex
      })

    return [
      {
        id: 'ALL',
        label: 'All',
        normalizedLabel: 'ALL',
        defaultColour: 'bg-nhs-yellow-tint'
      },
      ...enabledTypes.map((type) => ({
        id: type.id,
        label: type.label,
        normalizedLabel: type.normalizedLabel,
        defaultColour: type.defaultColour ?? null
      }))
    ]
  }, [staffTypes])

  useEffect(() => {
    if (selectedFilter === 'ALL') {
      return
    }
    const stillExists = staffTypes.some(
      (type) => type.isEnabled !== false && type.normalizedLabel === selectedFilter
    )
    if (!stillExists) {
      setSelectedFilter('ALL')
    }
  }, [staffTypes, selectedFilter])

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const matchesSearch = !searchTerm || 
        apt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (apt.notes && apt.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesFilter = selectedFilter === 'ALL' || (
        apt.staffType
          ? normalizeStaffLabel(apt.staffType) === selectedFilter
          : false
      )
      
      return matchesSearch && matchesFilter
    })
  }, [appointments, searchTerm, selectedFilter])

  const handleEdit = (appointment: AppointmentType) => {
    setEditingAppointment(appointment)
  }

  const handleSave = async (data: Partial<AppointmentType>) => {
    try {
      if (editingAppointment) {
        // Update existing
        const response = await fetch(`/api/admin/appointments/${editingAppointment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        if (!response.ok) throw new Error('Failed to update appointment')
        toast.success('Appointment updated')
      } else {
        // Create new
        const response = await fetch('/api/admin/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            surgeryId
          })
        })
        if (!response.ok) throw new Error('Failed to create appointment')
        toast.success('Appointment created')
      }
      setEditingAppointment(null)
      setShowAddModal(false)
      fetchAppointments()
    } catch (error) {
      console.error('Error saving appointment:', error)
      toast.error('Failed to save appointment')
    }
  }

  const handleUploadSuccess = () => {
    setShowUploadModal(false)
    fetchAppointments()
  }

  const handleDelete = (appointment: AppointmentType) => {
    setAppointmentPendingDelete(appointment)
  }

  const confirmDelete = async () => {
    if (!appointmentPendingDelete) {
      return
    }
    const deletedId = appointmentPendingDelete.id
    const previousAppointments = appointments

    // Optimistic update: remove from list immediately
    setAppointments(prev => prev.filter(a => a.id !== deletedId))
    setAppointmentPendingDelete(null)
    toast.success('Appointment deleted')

    try {
      const response = await fetch(`/api/admin/appointments/${deletedId}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Failed to delete appointment')
      }
    } catch (error) {
      // Revert on error
      console.error('Error deleting appointment:', error)
      setAppointments(previousAppointments)
      toast.error('Failed to delete appointment — reverted')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-nhs-dark-blue mb-2">
            Appointment Directory
          </h1>
          <p className="text-nhs-grey">
            {surgeryName}
          </p>
        </div>

        {/* Top Bar */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Search */}
            <div className="flex-1 w-full md:w-auto">
              <input
                type="text"
                placeholder="Search for an appointment…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
              {filterOptions.map((option) => (
                <button
                  key={option.normalizedLabel}
                  onClick={() => setSelectedFilter(option.normalizedLabel)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedFilter === option.normalizedLabel
                      ? 'bg-nhs-blue text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Admin Actions */}
            {isAdmin && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="rounded-md bg-nhs-green px-4 py-2 text-white transition-colors hover:bg-nhs-green-dark focus:outline-none focus:ring-2 focus:ring-nhs-green"
                >
                  Upload CSV
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="rounded-md bg-nhs-blue px-4 py-2 text-white transition-colors hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue"
                >
                  Add New Entry
                </button>
                <button
                  onClick={() => setShowStaffTypesModal(true)}
                  className="rounded-md border border-nhs-blue px-4 py-2 text-nhs-blue transition-colors hover:bg-nhs-light-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue"
                >
                  Manage Staff Teams
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Appointments Grid */}
        {loading ? (
          <SkeletonCardGrid count={8} showBadge lines={2} />
        ) : filteredAppointments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                isAdmin={isAdmin}
                onEdit={handleEdit}
                onDelete={isAdmin ? handleDelete : undefined}
                staffTypeMap={staffTypeMap}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            illustration={searchTerm || selectedFilter !== 'ALL' ? 'search' : 'calendar'}
            title={searchTerm || selectedFilter !== 'ALL'
              ? 'No appointments found'
              : 'No appointments yet'}
            description={searchTerm || selectedFilter !== 'ALL'
              ? 'No appointments match your current filters. Try adjusting your search or clearing filters.'
              : 'Upload a CSV file to populate your appointment directory.'}
            action={
              searchTerm || selectedFilter !== 'ALL'
                ? {
                    label: 'Clear Filters',
                    onClick: () => {
                      setSearchTerm('')
                      setSelectedFilter('ALL')
                    },
                    variant: 'secondary',
                  }
                : isAdmin
                  ? {
                      label: 'Upload CSV',
                      onClick: () => setShowUploadModal(true),
                    }
                  : undefined
            }
          />
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <Modal
            title="Upload appointments CSV"
            description="Import reception-friendly appointment types from a CSV file."
            onClose={() => setShowUploadModal(false)}
            initialFocusRef={uploadInputRef}
          >
            <AppointmentCsvUpload
              surgeryId={surgeryId}
              onSuccess={handleUploadSuccess}
              onCancel={() => setShowUploadModal(false)}
              inputRef={uploadInputRef}
            />
          </Modal>
        )}

        {/* Add/Edit Modal */}
        {(showAddModal || editingAppointment) && (
          <AppointmentEditModal
            appointment={editingAppointment}
            staffTypes={filterOptions}
            onSave={handleSave}
            onCancel={() => {
              setShowAddModal(false)
              setEditingAppointment(null)
            }}
          />
        )}

        {/* Delete confirmation modal */}
        {appointmentPendingDelete && (
          <Modal
            title="Delete appointment type"
            description="This removes the appointment from the directory. You can recreate it later if needed."
            onClose={() => setAppointmentPendingDelete(null)}
            initialFocusRef={deleteCancelButtonRef}
            widthClassName="max-w-lg"
          >
            <p className="text-sm text-nhs-grey">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-gray-900">
                {appointmentPendingDelete.name}
              </span>
              ? Reception staff will no longer see it in their directory.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                ref={deleteCancelButtonRef}
                type="button"
                className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-nhs-blue"
                onClick={() => setAppointmentPendingDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-nhs-red px-4 py-2 text-white transition-colors hover:bg-nhs-red-dark focus:outline-none focus:ring-2 focus:ring-nhs-red disabled:opacity-70"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </Modal>
        )}

        {showStaffTypesModal && (
          <StaffTypesManager
            surgeryId={surgeryId}
            staffTypes={staffTypes}
            onClose={() => setShowStaffTypesModal(false)}
            onUpdated={() => {
              fetchStaffTypes()
            }}
          />
        )}
      </div>
    </div>
  )
}

