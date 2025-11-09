'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Surgery } from '@prisma/client'
import AppointmentCsvUpload from '@/components/appointments/AppointmentCsvUpload'
import AppointmentCard from '@/components/appointments/AppointmentCard'
import AppointmentEditModal from '@/components/appointments/AppointmentEditModal'
import Modal from '@/components/appointments/Modal'
import SimpleHeader from '@/components/SimpleHeader'

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
  surgeries: Surgery[]
}

export default function AppointmentsPageClient({ 
  surgeryId, 
  surgeryName,
  isAdmin,
  surgeries
}: AppointmentsPageClientProps) {
  const [appointments, setAppointments] = useState<AppointmentType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<string>('All')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<AppointmentType | null>(null)
  const [appointmentPendingDelete, setAppointmentPendingDelete] = useState<AppointmentType | null>(null)
  const [deleting, setDeleting] = useState(false)
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

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      const matchesSearch = !searchTerm || 
        apt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (apt.notes && apt.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesFilter = selectedFilter === 'All' || 
        apt.staffType === selectedFilter ||
        (selectedFilter === 'Dr' && apt.staffType?.includes('Dr'))
      
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
    setDeleting(true)
    try {
      const response = await fetch(`/api/admin/appointments/${appointmentPendingDelete.id}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Failed to delete appointment')
      }
      toast.success('Appointment deleted')
      setAppointmentPendingDelete(null)
      fetchAppointments()
    } catch (error) {
      console.error('Error deleting appointment:', error)
      toast.error('Failed to delete appointment')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SimpleHeader
        surgeries={surgeries}
        currentSurgeryId={surgeryId}
        directoryLinkOverride={{
          href: `/s/${surgeryId}`,
          label: 'Back to main page'
        }}
      />
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
              {['All', 'PN', 'HCA', 'Dr'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedFilter === filter
                      ? 'bg-nhs-blue text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Admin Actions */}
            {isAdmin && (
              <div className="flex gap-2">
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
              </div>
            )}
          </div>
        </div>

        {/* Appointments Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-nhs-grey">Loading appointments...</div>
          </div>
        ) : filteredAppointments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                isAdmin={isAdmin}
                onEdit={handleEdit}
                onDelete={isAdmin ? handleDelete : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-nhs-grey text-lg mb-4">
              {searchTerm || selectedFilter !== 'All' 
                ? 'No appointments found matching your criteria.'
                : 'No appointments found. Upload a CSV to get started.'}
            </div>
            {isAdmin && !searchTerm && selectedFilter === 'All' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="rounded-md bg-nhs-blue px-4 py-2 text-white transition-colors hover:bg-nhs-dark-blue focus:outline-none focus:ring-2 focus:ring-nhs-blue"
              >
                Upload CSV
              </button>
            )}
          </div>
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
      </div>
    </div>
  )
}

