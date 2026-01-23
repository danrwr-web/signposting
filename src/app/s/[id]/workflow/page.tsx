import 'server-only'
import { requireSurgeryAccess, can } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getEffectiveWorkflows } from '@/server/effectiveWorkflows'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { CustomiseWorkflowButton } from '@/components/workflow/CustomiseWorkflowButton'
import NavigationMinimalHeader from '@/components/NavigationMinimalHeader'
import WorkflowLandingClient, { type WorkflowLandingItem } from './WorkflowLandingClient'

const GLOBAL_SURGERY_ID = 'global-default-buttons'

interface WorkflowDashboardPageProps {
  params: Promise<{
    id: string
  }>
}

interface WorkflowTemplateWithCategory {
  id: string
  name: string
  description: string | null
  iconKey: string | null
  landingCategory: string
  isDependent: boolean
  source: 'global' | 'override' | 'custom'
  sourceTemplateId: string | null
  approvalStatus: string
}

export default async function WorkflowDashboardPage({ params }: WorkflowDashboardPageProps) {
  const { id: surgeryId } = await params

  try {
    const user = await requireSurgeryAccess(surgeryId)

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

    // Check if workflow guidance feature is enabled for this surgery
    const workflowsEnabled = await isFeatureEnabledForSurgery(surgeryId, 'workflow_guidance')
    const isAdmin = can(user).isAdminOfSurgery(surgeryId)
    const isSuperuser = user.globalRole === 'SUPERUSER'
    const isGlobalSurgery = surgeryId === GLOBAL_SURGERY_ID
    const canCustomiseWorkflows = can(user).manageSurgery(surgeryId)
    
    // Allow admins to access even if workflows aren't enabled (so they can enable them)
    // For non-admins, show a message if workflows aren't enabled
    if (!workflowsEnabled && !isAdmin) {
      return (
        <div className="min-h-screen bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>Workflows are not enabled for {surgery.name}.</strong> Please contact an administrator to enable the workflow module.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Get effective workflows (resolves global defaults, overrides, and custom)
    // 
    // Draft visibility rules:
    // - Admins: Can see both DRAFT and APPROVED workflows (includeDrafts=true)
    // - Staff: Can only see APPROVED workflows (includeDrafts=false)
    // This ensures staff never see unapproved content, while admins can manage drafts safely.
    const effectiveWorkflows = await getEffectiveWorkflows(surgeryId, {
      includeDrafts: isAdmin, // Admins can see drafts, staff cannot
      includeInactive: false,
    })

    // Defensive de-duplication (and protects Global Default surgery view).
    // We always want each workflow to appear once on the landing page.
    const uniqueEffectiveWorkflows = Array.from(
      new Map(effectiveWorkflows.map((w) => [w.id, w])).values(),
    )

    // Get linkedFromNodes count for each workflow to identify dependent workflows
    const workflowIds = uniqueEffectiveWorkflows.map(w => w.id)
    const linkedCounts = await prisma.workflowNodeLink.groupBy({
      by: ['templateId'],
      where: {
        templateId: { in: workflowIds },
      },
      _count: {
        _all: true,
      },
    })
    const linkedCountMap = new Map(linkedCounts.map(l => [l.templateId, l._count._all]))

    // Classify workflows using workflowType field
    // Map MODULE to SUPPORTING for backwards compatibility
    const workflows: WorkflowTemplateWithCategory[] = uniqueEffectiveWorkflows.map((template) => {
      const isDependent = (linkedCountMap.get(template.id) ?? 0) > 0
      const workflowType = (template.workflowType as 'PRIMARY' | 'SUPPORTING' | 'MODULE') || 'SUPPORTING'
      // Map MODULE to SUPPORTING - treat all previously "Linked module" workflows as Supporting
      const landingCategory = workflowType === 'MODULE' ? 'SUPPORTING' : workflowType

      return {
        id: template.id,
        name: template.name,
        description: template.description,
        iconKey: template.iconKey ?? null,
        landingCategory,
        isDependent,
        source: template.source,
        sourceTemplateId: template.sourceTemplateId,
        approvalStatus: template.approvalStatus,
      }
    })

    // Separate workflows by type - workflowType is the single source of truth
    const primaryWorkflows = workflows.filter(w => w.landingCategory === 'PRIMARY')
    const supportingWorkflows = workflows.filter(w => w.landingCategory === 'SUPPORTING')

    const mainWorkflows = [...primaryWorkflows, ...supportingWorkflows]
    const clientWorkflows: WorkflowLandingItem[] = mainWorkflows.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      iconKey: w.iconKey,
      landingCategory: w.landingCategory,
      source: w.source,
      approvalStatus: w.approvalStatus,
    }))

    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <NavigationMinimalHeader backHref={`/s/${surgeryId}`} backLabel="Back to Signposting" />
          {/* Admin warning if workflows not enabled */}
          {isAdmin && !workflowsEnabled && (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    <strong>Workflows are not enabled for {surgery.name}.</strong> Workflows will not be visible to staff until enabled. You can still manage workflows as an admin.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <WorkflowLandingClient
            surgeryId={surgeryId}
            surgeryName={surgery.name}
            isGlobalSurgery={isGlobalSurgery}
            canCustomiseWorkflows={canCustomiseWorkflows}
            workflows={clientWorkflows}
          />

          {/* Empty State */}
          {mainWorkflows.length === 0 && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-500 mb-4">No workflow templates available.</p>
              {isAdmin && (
                <Link
                  href={`/s/${surgeryId}/workflow/templates`}
                  className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-4 py-2"
                >
                  Create a template to get started
                </Link>
              )}
            </div>
          )}

          {/* Management - Visually Quiet */}
          {isAdmin && (
            <section className="mt-14 pt-8 border-t border-gray-200" aria-labelledby="admin-tools-heading">
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <h2 id="admin-tools-heading" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Management
                </h2>
                <span className="text-xs text-gray-400">Admin only</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                These options are for managing workflows and defaults.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/s/${surgeryId}/workflow/templates`}
                  className="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-3 py-1.5 transition-colors"
                >
                  Manage Templates
                </Link>
                {isSuperuser && (
                  <Link
                    href={`/s/${surgeryId}/workflow/admin/styles`}
                    className="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-3 py-1.5 transition-colors"
                  >
                    Node styling defaults
                  </Link>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    )
  } catch (error) {
    console.error('[WorkflowDashboard] Error:', error)
    redirect('/unauthorized')
  }
}

