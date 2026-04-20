export interface PipelineEntry {
  id: string
  practiceName: string
  practiceAddress: string | null
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
  invoiceGeneratedAt: string | null
  invoicePaidAt: string | null
  contractVariantLabel: string | null
  contractVariantId: string | null
  contractVariant: { id: string; name: string } | null
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

export type DocumentType =
  | 'Proposal'
  | 'SaasAgreement'
  | 'Dpa'
  | 'HostingOverview'
  | 'IgSecurityPack'
  | 'SetupGuide'

export const DOCUMENT_TYPES: DocumentType[] = [
  'Proposal',
  'SaasAgreement',
  'Dpa',
  'HostingOverview',
  'IgSecurityPack',
  'SetupGuide',
]

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  Proposal: 'Post-Demo Proposal',
  SaasAgreement: 'SaaS Agreement',
  Dpa: 'Data Processing Agreement',
  HostingOverview: 'Hosting & IG Overview',
  IgSecurityPack: 'IG & Security Response Pack',
  SetupGuide: 'Practice Setup Guide',
}

/** Document types whose template varies by contract variant */
export const VARIANT_SPECIFIC_TYPES: DocumentType[] = ['Proposal', 'SaasAgreement']

/** Document types that use a single shared template across all variants */
export const SHARED_DOC_TYPES: DocumentType[] = ['Dpa', 'HostingOverview', 'IgSecurityPack']

/** Document types that stand alone with no variant (one template total) */
export const STANDALONE_DOC_TYPES: DocumentType[] = ['SetupGuide']

export const STATUS_BADGE_COLOURS: Record<PipelineStatus, string> = {
  Enquiry: 'gray',
  DemoBooked: 'blue',
  DemoCompleted: 'green',
  ProposalSent: 'purple',
  DocumentsSent: 'blue',
  Contracted: 'nhs-green',
  OnHold: 'amber',
  Lost: 'red',
}
