/**
 * Client-side document generation using docxtemplater + PizZip.
 *
 * Fetches the stored .docx template from the API, substitutes
 * {{placeholders}} with practice details using docxtemplater (which
 * handles Word's split-run XML problem natively), and triggers a
 * browser download. Runs client-side only — do not import in server
 * components.
 */

import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { DOCUMENT_TYPE_LABELS, type DocumentType } from './types'

// ── Practice details interface ──────────────────────────────────────

export interface PracticeDetails {
  practiceName: string
  practiceAddress: string
  contactName: string
  contactRole: string
  contactEmail: string
  listSize: string
  estimatedFee: string
  contractStartDate: string
}

// ── Public API ──────────────────────────────────────────────────────

export async function generateDocument(
  variantId: string,
  documentType: DocumentType,
  details: PracticeDetails
): Promise<void> {
  // 1. Fetch the template .docx bytes from the API
  const res = await fetch(
    `/api/super/pipeline/contract-variants/${variantId}/templates/${documentType}`
  )

  if (!res.ok) {
    throw new Error('Failed to fetch template')
  }

  const arrayBuffer = await res.arrayBuffer()

  // 2. Unzip and run docxtemplater substitution
  const zip = new PizZip(arrayBuffer)
  const doc = new Docxtemplater(zip, {
    delimiters: { start: '{{', end: '}}' },
    paragraphLoop: true,
    linebreaks: true,
    // Silently ignore undefined placeholders rather than throwing
    nullGetter: () => '',
  })

  const now = new Date()
  const currentDate = now.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const currentYear = now.getFullYear().toString()

  doc.render({
    practiceName: details.practiceName || '[Practice Name]',
    practiceAddress: details.practiceAddress || '[Practice Address]',
    contactName: details.contactName || '[Contact Name]',
    contactRole: details.contactRole || '[Contact Role]',
    contactEmail: details.contactEmail || '[Contact Email]',
    listSize: details.listSize || '[List Size]',
    estimatedFee: details.estimatedFee || '[Estimated Fee]',
    contractStartDate: details.contractStartDate || '[Contract Start Date]',
    currentDate,
    currentYear,
  })

  // 3. Generate the output .docx blob
  const blob = doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

  // 4. Trigger browser download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${DOCUMENT_TYPE_LABELS[documentType]} - ${details.practiceName || 'Practice'}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
