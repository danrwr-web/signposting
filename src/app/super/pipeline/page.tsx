export const dynamic = 'force-dynamic'
export const revalidate = 0
import 'server-only'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import PipelinePageClient from './PipelinePageClient'

export default async function PipelinePage() {
  await requireSuperuser()

  const entries = await prisma.salesPipeline.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      linkedSurgery: {
        select: { id: true, name: true, slug: true },
      },
    },
  })

  // Serialise dates for client component
  const serialised = entries.map((e) => ({
    ...e,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    dateEnquiry: e.dateEnquiry?.toISOString() ?? null,
    dateDemoBooked: e.dateDemoBooked?.toISOString() ?? null,
    dateDemoCompleted: e.dateDemoCompleted?.toISOString() ?? null,
    dateProposalSent: e.dateProposalSent?.toISOString() ?? null,
    dateOnboardingFormSent: e.dateOnboardingFormSent?.toISOString() ?? null,
    dateSaasAgreementSent: e.dateSaasAgreementSent?.toISOString() ?? null,
    dateSaasAgreementSigned: e.dateSaasAgreementSigned?.toISOString() ?? null,
    dateDpaSent: e.dateDpaSent?.toISOString() ?? null,
    dateDpaSigned: e.dateDpaSigned?.toISOString() ?? null,
    dateContractStart: e.dateContractStart?.toISOString() ?? null,
    trialEndDate: e.trialEndDate?.toISOString() ?? null,
  }))

  return <PipelinePageClient initialEntries={serialised} />
}
