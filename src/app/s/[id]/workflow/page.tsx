import 'server-only'
import { requireSurgeryAccess, can } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getEffectiveWorkflows, isWorkflowsEnabled } from '@/server/effectiveWorkflows'
import { CustomiseWorkflowButton } from '@/components/workflow/CustomiseWorkflowButton'

interface WorkflowDashboardPageProps {
  params: Promise<{
    id: string
  }>
}

type WorkflowCategory = 'PRIMARY' | 'SECONDARY' | 'ADMIN'

interface WorkflowTemplateWithCategory {
  id: string
  name: string
  description: string | null
  landingCategory: string
  isDependent: boolean
  source: 'global' | 'override' | 'custom'
  sourceTemplateId: string | null
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

    // Check if workflows are enabled for this surgery
    const workflowsEnabled = await isWorkflowsEnabled(surgeryId)
    const isAdmin = can(user).isAdminOfSurgery(surgeryId)
    
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
    const effectiveWorkflows = await getEffectiveWorkflows(surgeryId, {
      includeDrafts: false, // Staff view: only show approved workflows
      includeInactive: false,
    })

    // Get linkedFromNodes count for each workflow to identify dependent workflows
    const workflowIds = effectiveWorkflows.map(w => w.id)
    const linkedCounts = await prisma.workflowNodeLink.groupBy({
      by: ['linkedTemplateId'],
      where: {
        linkedTemplateId: { in: workflowIds },
      },
      _count: true,
    })
    const linkedCountMap = new Map(linkedCounts.map(l => [l.linkedTemplateId, l._count]))

    // Classify workflows using workflowType field
    const workflows: WorkflowTemplateWithCategory[] = effectiveWorkflows.map((template) => {
      const isDependent = (linkedCountMap.get(template.id) ?? 0) > 0
      const workflowType = (template.workflowType as 'PRIMARY' | 'SUPPORTING' | 'MODULE') || 'SUPPORTING'

      return {
        id: template.id,
        name: template.name,
        description: template.description,
        landingCategory: workflowType,
        isDependent,
        source: template.source,
        sourceTemplateId: template.sourceTemplateId,
      }
    })

    // Separate workflows by type - workflowType is the single source of truth
    const primaryWorkflows = workflows.filter(w => w.landingCategory === 'PRIMARY')
    const supportingWorkflows = workflows.filter(w => w.landingCategory === 'SUPPORTING')
    const moduleWorkflows = workflows.filter(w => w.landingCategory === 'MODULE')

    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
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
          
          {/* Header */}
          <div className="mb-16">
            <h1 className="text-4xl sm:text-5xl font-semibold text-gray-900 mb-4 tracking-tight">
              Document Workflow Guidance
            </h1>
            <p className="text-xl text-gray-600 mb-3 leading-relaxed">
              Visual guidance for handling documents at {surgery.name}
            </p>
            <p className="text-base text-gray-500 max-w-2xl leading-relaxed">
              Step-by-step workflows to help reception and care navigation teams handle documents consistently and efficiently.
            </p>
          </div>

          {/* Primary Document Workflows - Dominant */}
          {primaryWorkflows.length > 0 && (
            <section className="mb-20" aria-labelledby="primary-workflows-heading">
              <h2 id="primary-workflows-heading" className="text-xl font-medium text-gray-900 mb-6">
                Primary document workflow{primaryWorkflows.length > 1 ? 's' : ''}
              </h2>
              {primaryWorkflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="group relative block bg-blue-50/50 rounded-2xl border-2 border-blue-100 p-10 hover:border-blue-200 hover:shadow-xl transition-all duration-300 mb-6 last:mb-0"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-2xl font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                          {workflow.name}
                        </h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Primary
                        </span>
                        {workflow.source === 'global' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            Global Default
                          </span>
                        )}
                        {workflow.source === 'override' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                            Customised
                          </span>
                        )}
                      </div>
                      {workflow.description && (
                        <p className="text-base text-gray-700 mb-6 leading-relaxed max-w-3xl">
                          {workflow.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/s/${surgeryId}/workflow/templates/${workflow.id}/view`}
                      className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Open workflow
                      <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                    {isAdmin && workflow.source === 'global' && workflow.sourceTemplateId === null && (
                      <CustomiseWorkflowButton
                        surgeryId={surgeryId}
                        globalTemplateId={workflow.id}
                        workflowName={workflow.name}
                      />
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}


          {/* Supporting Workflows - Calmer Grid */}
          {supportingWorkflows.length > 0 && (
            <section className="mb-20" aria-labelledby="supporting-workflows-heading">
              <h2 id="supporting-workflows-heading" className="text-lg font-medium text-gray-700 mb-6">
                Supporting workflows
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {supportingWorkflows.map((template) => (
                  <div
                    key={template.id}
                    className="group bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors flex-1">
                        {template.name}
                      </h3>
                      {template.source === 'global' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 ml-2">
                          Global
                        </span>
                      )}
                      {template.source === 'override' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 ml-2">
                          Custom
                        </span>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">
                        {template.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/s/${surgeryId}/workflow/templates/${template.id}/view`}
                        className="text-sm font-medium text-gray-600 group-hover:text-blue-600 transition-colors inline-flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                      >
                        View
                        <svg className="ml-1.5 w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                      {isAdmin && template.source === 'global' && template.sourceTemplateId === null && (
                        <CustomiseWorkflowButton
                          surgeryId={surgeryId}
                          globalTemplateId={template.id}
                          workflowName={template.name}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Linked Modules - Very Subdued */}
          {moduleWorkflows.length > 0 && (
            <section className="mb-16" aria-labelledby="module-workflows-heading">
              <h2 id="module-workflows-heading" className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wide">
                Linked Modules
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {moduleWorkflows.map((template) => (
                  <Link
                    key={template.id}
                    href={`/s/${surgeryId}/workflow/templates/${template.id}/view`}
                    className="group bg-gray-50 rounded-lg border border-gray-100 p-4 hover:bg-white hover:border-gray-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <h3 className="text-sm font-medium text-gray-600 mb-1 group-hover:text-gray-900 transition-colors">
                      {template.name}
                    </h3>
                    <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
                      View →
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {primaryWorkflows.length === 0 && supportingWorkflows.length === 0 && moduleWorkflows.length === 0 && (
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

          {/* Admin Tools - Visually Quiet */}
          {isAdmin && (
            <section className="mt-24 pt-10 border-t border-gray-100" aria-labelledby="admin-tools-heading">
              <h2 id="admin-tools-heading" className="text-xs font-medium text-gray-400 mb-4 uppercase tracking-wide">
                Admin Tools
              </h2>
              <div className="flex flex-wrap gap-4">
                <Link
                  href={`/s/${surgeryId}/workflow/templates`}
                  className="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-3 py-1.5 transition-colors"
                >
                  Manage Templates
                </Link>
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

