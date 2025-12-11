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

    // Get active templates
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
      }
    })

    // Check if user is admin
    const isAdmin = can(user).isAdminOfSurgery(surgeryId)

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Document Workflow Guidance
            </h1>
            <p className="text-gray-600">
              Visual guidance for handling documents at {surgery.name}
            </p>
          </div>

          <div className="space-y-6">
            {/* Active Templates Grid */}
            {activeTemplates.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500 mb-2">No workflow templates available.</p>
                {isAdmin && (
                  <Link
                    href={`/s/${surgeryId}/workflow/templates`}
                    className="text-blue-600 hover:text-blue-800 underline text-sm"
                  >
                    Create a template to get started
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-white rounded-lg shadow border border-gray-200 p-6 flex flex-col"
                  >
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">
                      {template.name}
                    </h2>
                    {template.description && (
                      <p className="text-sm text-gray-600 mb-4 flex-1">
                        {template.description}
                      </p>
                    )}
                    <Link
                      href={`/s/${surgeryId}/workflow/templates/${template.id}/view`}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      View Diagram
                    </Link>
                  </div>
                ))}
              </div>
            )}

            {/* Admin Tools Section */}
            {isAdmin && (
              <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">
                  Admin Tools
                </h2>
                <div className="space-y-2">
                  <Link
                    href={`/s/${surgeryId}/workflow/templates`}
                    className="block text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Manage Templates
                  </Link>
                  <Link
                    href={`/s/${surgeryId}/workflow/start`}
                    className="block text-sm text-gray-600 hover:text-gray-800 underline text-xs"
                  >
                    Runner / Instances (beta)
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('[WorkflowDashboard] Error:', error)
    redirect('/unauthorized')
  }
}

