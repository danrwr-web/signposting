const APPOINTMENT_IMAGE_ID_RE = /\/api\/appointment-images\/([a-z0-9]+)/gi

/**
 * Collect the AppointmentImage ids referenced by appointment notes HTML.
 * Saving an appointment claims still-unowned rows (uploaded from the create
 * modal before the appointment existed) so they cascade with the appointment.
 */
export function extractAppointmentImageIds(...contents: Array<string | null | undefined>): string[] {
  const ids = new Set<string>()
  for (const content of contents) {
    if (!content) continue
    for (const match of content.matchAll(APPOINTMENT_IMAGE_ID_RE)) {
      ids.add(match[1])
    }
  }
  return Array.from(ids)
}
