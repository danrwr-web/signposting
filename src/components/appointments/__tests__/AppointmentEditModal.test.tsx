/**
 * Regression tests for the appointment edit modal's notes editor.
 *
 * The editor is uncontrolled (hydrates once, re-hydrates only on docId
 * change), so the stored notes must be present in the `value` prop on the
 * very first render — an effect-set state arrives after the editor is
 * created and left the field blank when editing an existing appointment.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import AppointmentEditModal from '@/components/appointments/AppointmentEditModal'
import type { AppointmentType } from '@/components/appointments/types'

// TipTap needs a few DOM APIs jsdom does not implement.
beforeAll(() => {
  Range.prototype.getBoundingClientRect = () =>
    ({ x: 0, y: 0, top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect
  Range.prototype.getClientRects = () =>
    ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  document.elementFromPoint = () => null
})

const baseAppointment: AppointmentType = {
  id: 'apt-1',
  name: 'Flu jab',
  staffType: 'Nurse',
  durationMins: 10,
  colour: null,
  notes: null,
  notesHtml: null,
  isEnabled: true,
}

const staffTypes = [
  { id: 'ALL', label: 'All', normalizedLabel: 'ALL', defaultColour: 'bg-nhs-yellow-tint' },
]

const renderModal = (appointment: AppointmentType | null) =>
  render(
    <AppointmentEditModal
      appointment={appointment}
      surgeryId="sur-1"
      staffTypes={staffTypes}
      onSave={jest.fn()}
      onCancel={jest.fn()}
    />
  )

describe('AppointmentEditModal notes editor', () => {
  it('shows the stored rich-text notes when editing an existing appointment', async () => {
    renderModal({ ...baseAppointment, notesHtml: '<p>Bring your <strong>medication list</strong></p>' })

    await waitFor(() => {
      expect(screen.getByText(/medication list/)).toBeInTheDocument()
    })
  })

  it('falls back to legacy plain notes with line breaks converted', async () => {
    renderModal({ ...baseAppointment, notes: 'Line one\nLine two' })

    await waitFor(() => {
      expect(screen.getByText(/Line one/)).toBeInTheDocument()
      expect(screen.getByText(/Line two/)).toBeInTheDocument()
    })
  })

  it('shows tag-shaped literal text in legacy notes verbatim, not as markup', async () => {
    renderModal({ ...baseAppointment, notes: 'Use <code>ABC</code> literally & carefully' })

    await waitFor(() => {
      expect(screen.getByText(/Use <code>ABC<\/code> literally & carefully/)).toBeInTheDocument()
    })
  })

  it('starts empty when creating a new appointment', async () => {
    renderModal(null)

    const editor = await screen.findByTestId('appointment-notes-editor')
    await waitFor(() => {
      expect(editor.querySelector('.ProseMirror')).toBeInTheDocument()
    })
    expect(editor.querySelector('.ProseMirror')).toHaveTextContent('')
  })
})
