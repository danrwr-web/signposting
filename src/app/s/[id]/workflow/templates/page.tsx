import 'server-only'
import { requireSuperuserOrSurgeryAdmin, can } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getEffectiveWorkflows } from '@/server/effectiveWorkflows'
import TemplatesClient from './TemplatesClient'

interface WorkflowTemplatesPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function WorkflowTemplatesPage({ params }: WorkflowTemplatesPageProps) {
  const { id: surgeryId } = await params

  try {
    const user = await requireSuperuserOrSurgeryAdmin(surgeryId)

    // Get surgery details
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: {
        id: true,
        name: true,
      }
    })

    if (!surgery) {
      redirect('/unauthorized')
    }

    // Get effective workflows (includes global defaults, overrides, and custom)
    // Admins can see drafts, so includeDrafts=true
    const isAdmin = can(user).isAdminOfSurgery(surgeryId)
    const isSuperuser = user.globalRole === 'SUPERUSER'
    const effectiveWorkflows = await getEffectiveWorkflows(surgeryId, {
      includeDrafts: isAdmin, // Admins see drafts, staff do not
      includeInactive: true, // Show all for admin management
    })

    // Transform to format expected by TemplatesClient
    const templates = effectiveWorkflows.map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      iconKey: w.iconKey,
      isActive: w.isActive,
      workflowType: w.workflowType,
      createdAt: w.createdAt,
      approvalStatus: w.approvalStatus,
      source: w.source,
      sourceTemplateId: w.sourceTemplateId,
    }))

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <TemplatesClient surgeryId={surgeryId} templates={templates} isSuperuser={isSuperuser} />
        </div>
      </div>
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}

