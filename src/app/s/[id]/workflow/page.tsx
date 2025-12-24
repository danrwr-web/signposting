import 'server-only'
import { requireSurgeryAccess, can } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

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

    // Get active templates with linkedFromNodes count to identify dependent workflows
    const activeTemplates = await prisma.workflowTemplate.findMany({
      where: {
        surgeryId,
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        description: true,
        landingCategory: true,
        _count: {
          select: {
            linkedFromNodes: true,
          },
        },
      }
    })

    // TODO: make landing category editable via admin UI
    // For now, hard-code "Discharge Summaries" as the primary workflow
    const PRIMARY_WORKFLOW_NAME = 'Discharge Summaries'
    
    // Classify workflows: identify primary workflow by name match, everything else is supporting
    const workflows: WorkflowTemplateWithCategory[] = activeTemplates.map((template) => {
      const isDependent = template._count.linkedFromNodes > 0
      const normalizedName = template.name.trim()
      const isPrimaryWorkflow = normalizedName.toLowerCase() === PRIMARY_WORKFLOW_NAME.toLowerCase()

      return {
        id: template.id,
        name: template.name,
        description: template.description,
        landingCategory: isPrimaryWorkflow ? 'PRIMARY' : 'SECONDARY',
        isDependent,
      }
    })

    // Separate primary workflow (Discharge Summaries) from supporting workflows
    const primaryWorkflow = workflows.find(w => w.landingCategory === 'PRIMARY')
    const supportingWorkflows = workflows.filter(w => w.landingCategory === 'SECONDARY')
    const adminWorkflows = workflows.filter(w => w.landingCategory === 'ADMIN')

    // Check if user is admin
    const isAdmin = can(user).isAdminOfSurgery(surgeryId)

    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
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

          {/* Primary Document Workflow - Dominant */}
          {primaryWorkflow && (
            <section className="mb-20" aria-labelledby="primary-workflow-heading">
              <h2 id="primary-workflow-heading" className="text-xl font-medium text-gray-900 mb-6">
                Primary document workflow
              </h2>
              <Link
                href={`/s/${surgeryId}/workflow/templates/${primaryWorkflow.id}/view`}
                className="group relative block bg-blue-50/50 rounded-2xl border-2 border-blue-100 p-10 hover:border-blue-200 hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-2xl font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                        {primaryWorkflow.name}
                      </h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Primary
                      </span>
                    </div>
                    {primaryWorkflow.description && (
                      <p className="text-base text-gray-700 mb-6 leading-relaxed max-w-3xl">
                        {primaryWorkflow.description}
                      </p>
                    )}
                  </div>
                </div>
                <span className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg group-hover:bg-blue-700 transition-colors shadow-sm">
                  Open workflow
                  <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
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
                  <Link
                    key={template.id}
                    href={`/s/${surgeryId}/workflow/templates/${template.id}/view`}
                    className="group bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-300 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <h3 className="text-base font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {template.name}
                    </h3>
                    {template.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">
                        {template.description}
                      </p>
                    )}
                    <span className="text-sm font-medium text-gray-600 group-hover:text-blue-600 transition-colors inline-flex items-center">
                      View
                      <svg className="ml-1.5 w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {!primaryWorkflow && supportingWorkflows.length === 0 && (
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
                <Link
                  href={`/s/${surgeryId}/workflow/start`}
                  className="text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-3 py-1.5 transition-colors"
                >
                  Runner / Instances (beta)
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

