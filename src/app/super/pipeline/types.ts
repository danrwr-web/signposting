export interface PipelineEntry {
  id: string
  practiceName: string
  townCity: string | null
  pcnName: string | null
  listSize: number | null
  estimatedFeeGbp: number | null
  contactName: string | null
  contactRole: string | null
  contactEmail: string | null
  status: PipelineStatus
  dateEnquiry: string | null
  dateDemoBooked: string | null
  dateDemoCompleted: string | null
  dateProposalSent: string | null
  dateOnboardingFormSent: string | null
  dateSaasAgreementSent: string | null
  dateSaasAgreementSigned: string | null
  dateDpaSent: string | null
  dateDpaSigned: string | null
  dateContractStart: string | null
  freeTrial: boolean
  trialEndDate: string | null
  annualValueGbp: number | null
  contractVariant: string | null
  notes: string | null
  linkedSurgeryId: string | null
  linkedSurgery: { id: string; name: string; slug: string | null } | null
  createdAt: string
  updatedAt: string
}

export type PipelineStatus =
  | 'Enquiry'
  | 'DemoBooked'
  | 'DemoCompleted'
  | 'ProposalSent'
  | 'DocumentsSent'
  | 'Contracted'
  | 'OnHold'
  | 'Lost'

export const PIPELINE_STATUSES: PipelineStatus[] = [
  'Enquiry',
  'DemoBooked',
  'DemoCompleted',
  'ProposalSent',
  'DocumentsSent',
  'Contracted',
  'OnHold',
  'Lost',
]

export const STATUS_LABELS: Record<PipelineStatus, string> = {
  Enquiry: 'Enquiry',
  DemoBooked: 'Demo Booked',
  DemoCompleted: 'Demo Completed',
  ProposalSent: 'Proposal Sent',
  DocumentsSent: 'Documents Sent',
  Contracted: 'Contracted',
  OnHold: 'On Hold',
  Lost: 'Lost',
}

export const STATUS_BADGE_COLOURS: Record<PipelineStatus, string> = {
  Enquiry: 'gray',
  DemoBooked: 'blue',
  DemoCompleted: 'green',
  ProposalSent: 'purple',
  DocumentsSent: 'nhs-green',
  Contracted: 'nhs-green',
  OnHold: 'amber',
  Lost: 'red',
}
