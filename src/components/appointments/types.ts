export interface AppointmentType {
  id: string
  name: string
  staffType: string | null
  durationMins: number | null
  colour: string | null
  /** Plain-text fallback, derived server-side from notesHtml; used for search. */
  notes: string | null
  /** Canonical rich-text notes (sanitized HTML, may embed appointment images). */
  notesHtml: string | null
  isEnabled: boolean
}
