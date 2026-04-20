import * as XLSX from 'xlsx'
import { PipelineEntry, STATUS_LABELS } from './types'

function toDateStr(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function daysBetween(from: string | null, to: Date): number | string {
  if (!from) return ''
  const d = new Date(from)
  return Math.floor((to.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

export function exportPipelineToExcel(entries: PipelineEntry[]) {
  const wb = XLSX.utils.book_new()
  const now = new Date()

  // ── Sheet 1: Pipeline Tracker ─────────────────────────────────────
  const trackerRows = entries.map((e) => ({
    'Practice Name': e.practiceName,
    'Practice Address': e.practiceAddress ?? '',
    'Town/City': e.townCity ?? '',
    PCN: e.pcnName ?? '',
    'List Size': e.listSize ?? '',
    'Est. Fee (£)': e.estimatedFeeGbp ?? '',
    'Contact Name': e.contactName ?? '',
    'Contact Role': e.contactRole ?? '',
    'Contact Email': e.contactEmail ?? '',
    Status: STATUS_LABELS[e.status],
    'Date Enquiry': toDateStr(e.dateEnquiry),
    'Date Demo Booked': toDateStr(e.dateDemoBooked),
    'Date Demo Completed': toDateStr(e.dateDemoCompleted),
    'Date Proposal Sent': toDateStr(e.dateProposalSent),
    'Date Onboarding Form Sent': toDateStr(e.dateOnboardingFormSent),
    'Date SaaS Agreement Sent': toDateStr(e.dateSaasAgreementSent),
    'Date SaaS Agreement Signed': toDateStr(e.dateSaasAgreementSigned),
    'Date DPA Sent': toDateStr(e.dateDpaSent),
    'Date DPA Signed': toDateStr(e.dateDpaSigned),
    'Date Contract Start': toDateStr(e.dateContractStart),
    'Free Trial': e.freeTrial ? 'Yes' : 'No',
    'Trial End Date': toDateStr(e.trialEndDate),
    'Annual Value (£)': e.annualValueGbp ?? '',
    'Invoice Generated': toDateStr(e.invoiceGeneratedAt),
    'Invoice Paid': toDateStr(e.invoicePaidAt),
    'Contract Variant': e.contractVariant?.name ?? e.contractVariantLabel ?? '',
    'Days in Pipeline': daysBetween(e.dateEnquiry, now),
    Notes: e.notes ?? '',
  }))

  const ws1 = XLSX.utils.json_to_sheet(trackerRows)

  // Set column widths
  ws1['!cols'] = [
    { wch: 25 }, // Practice Name
    { wch: 15 }, // Town/City
    { wch: 20 }, // PCN
    { wch: 10 }, // List Size
    { wch: 12 }, // Est. Fee
    { wch: 20 }, // Contact Name
    { wch: 18 }, // Contact Role
    { wch: 25 }, // Contact Email
    { wch: 18 }, // Status
    { wch: 14 }, // Date Enquiry
    { wch: 16 }, // Date Demo Booked
    { wch: 18 }, // Date Demo Completed
    { wch: 17 }, // Date Proposal Sent
    { wch: 22 }, // Date Onboarding Form Sent
    { wch: 22 }, // Date SaaS Agreement Sent
    { wch: 24 }, // Date SaaS Agreement Signed
    { wch: 14 }, // Date DPA Sent
    { wch: 16 }, // Date DPA Signed
    { wch: 16 }, // Date Contract Start
    { wch: 10 }, // Free Trial
    { wch: 14 }, // Trial End Date
    { wch: 14 }, // Annual Value
    { wch: 18 }, // Invoice Generated
    { wch: 14 }, // Invoice Paid
    { wch: 22 }, // Contract Variant
    { wch: 14 }, // Days in Pipeline
    { wch: 30 }, // Notes
  ]

  XLSX.utils.book_append_sheet(wb, ws1, 'Pipeline Tracker')

  // ── Sheet 2: Summary Dashboard ────────────────────────────────────
  const contracted = entries.filter((e) => e.status === 'Contracted')
  const inProgress = entries.filter(
    (e) => !['Contracted', 'Lost', 'OnHold'].includes(e.status)
  )
  const lost = entries.filter((e) => e.status === 'Lost')
  const onHold = entries.filter((e) => e.status === 'OnHold')

  const contractedListSize = contracted.reduce((s, e) => s + (e.listSize ?? 0), 0)
  const contractedArr = contracted.reduce(
    (s, e) => s + (e.annualValueGbp ?? e.estimatedFeeGbp ?? 0),
    0
  )
  const pipelineArr = inProgress.reduce(
    (s, e) => s + (e.annualValueGbp ?? e.estimatedFeeGbp ?? 0),
    0
  )

  const summaryData = [
    ['Metric', 'Value'],
    ['Total Practices', entries.length],
    ['Contracted', contracted.length],
    ['In Progress', inProgress.length],
    ['On Hold', onHold.length],
    ['Lost', lost.length],
    ['', ''],
    ['Contracted List Size', contractedListSize],
    ['Contracted ARR (£)', contractedArr],
    ['Pipeline ARR (£)', pipelineArr],
    ['', ''],
    ['Report Generated', now.toLocaleDateString('en-GB')],
  ]

  const ws2 = XLSX.utils.aoa_to_sheet(summaryData)
  ws2['!cols'] = [{ wch: 22 }, { wch: 18 }]

  XLSX.utils.book_append_sheet(wb, ws2, 'Summary Dashboard')

  // ── Download ──────────────────────────────────────────────────────
  const date = now.toISOString().slice(0, 10)
  XLSX.writeFile(wb, `Sales-Pipeline-${date}.xlsx`)
}
