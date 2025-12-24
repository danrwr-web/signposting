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

    // Classify workflows: use landingCategory, but if PRIMARY and has linkedFromNodes, treat as SECONDARY
    const workflows: WorkflowTemplateWithCategory[] = activeTemplates.map((template) => {
      const isDependent = template._count.linkedFromNodes > 0
      let category: WorkflowCategory = (template.landingCategory as WorkflowCategory) || 'PRIMARY'
      
      // If marked as PRIMARY but is dependent, treat as SECONDARY for display
      if (category === 'PRIMARY' && isDependent) {
        category = 'SECONDARY'
      }

      return {
        id: template.id,
        name: template.name,
        description: template.description,
        landingCategory: category,
        isDependent,
      }
    })

    // Group workflows by category
    const primaryWorkflows = workflows.filter(w => w.landingCategory === 'PRIMARY')
    const secondaryWorkflows = workflows.filter(w => w.landingCategory === 'SECONDARY')
    const adminWorkflows = workflows.filter(w => w.landingCategory === 'ADMIN')

    // Check if user is admin
    const isAdmin = can(user).isAdminOfSurgery(surgeryId)

    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 mb-3 tracking-tight">
              Document Workflow Guidance
            </h1>
            <p className="text-lg text-gray-600 mb-2">
              Visual guidance for handling documents at {surgery.name}
            </p>
            <p className="text-sm text-gray-500 max-w-2xl">
              Step-by-step workflows to help reception and care navigation teams handle documents consistently and efficiently.
            </p>
          </div>

          {/* Primary Workflows - Prominent */}
          {primaryWorkflows.length > 0 && (
            <section className="mb-16" aria-labelledby="primary-workflows-heading">
              <h2 id="primary-workflows-heading" className="text-xl font-medium text-gray-900 mb-6">
                Primary Entry Points
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {primaryWorkflows.map((template) => (
                  <Link
                    key={template.id}
                    href={`/s/${surgeryId}/workflow/templates/${template.id}/view`}
                    className="group relative bg-white rounded-xl border border-gray-200 p-8 hover:border-gray-300 hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                      {template.name}
                    </h3>
                    {template.description && (
                      <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                        {template.description}
                      </p>
                    )}
                    <span className="inline-flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-700">
                      View diagram
                      <svg className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Secondary Workflows - Less Prominent */}
          {secondaryWorkflows.length > 0 && (
            <section className="mb-16" aria-labelledby="secondary-workflows-heading">
              <h2 id="secondary-workflows-heading" className="text-lg font-medium text-gray-700 mb-5">
                Supporting Workflows
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {secondaryWorkflows.map((template) => (
                  <Link
                    key={template.id}
                    href={`/s/${surgeryId}/workflow/templates/${template.id}/view`}
                    className="group bg-gray-50 rounded-lg border border-gray-200 p-5 hover:bg-white hover:border-gray-300 hover:shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <h3 className="text-base font-medium text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {template.name}
                    </h3>
                    {template.description && (
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    <span className="text-xs font-medium text-gray-600 group-hover:text-blue-600 transition-colors">
                      View →
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {primaryWorkflows.length === 0 && secondaryWorkflows.length === 0 && (
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

          {/* Admin Tools - Visually De-emphasised */}
          {isAdmin && (
            <section className="mt-16 pt-8 border-t border-gray-200" aria-labelledby="admin-tools-heading">
              <h2 id="admin-tools-heading" className="text-sm font-medium text-gray-500 mb-4">
                Admin Tools
              </h2>
              <div className="flex flex-wrap gap-4">
                <Link
                  href={`/s/${surgeryId}/workflow/templates`}
                  className="text-sm text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-3 py-1.5 transition-colors"
                >
                  Manage Templates
                </Link>
                <Link
                  href={`/s/${surgeryId}/workflow/start`}
                  className="text-sm text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md px-3 py-1.5 transition-colors"
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

