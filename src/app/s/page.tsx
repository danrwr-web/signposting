import { redirect } from 'next/navigation'

// `/s` is the app entry route when there is no explicit surgery context.
// We keep this route so internal navigation (e.g. header logo fallback) never 404s.
export default function SurgeryEntryPage() {
  redirect('/')
}

