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

    // Get recent workflow instances
    const instances = await prisma.workflowInstance.findMany({
      where: {
        surgeryId,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
          }
        },
        startedBy: {
          select: {
            name: true,
            email: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    })

    // Check if user is admin (for template management link)
    const isAdmin = can(user).isAdminOfSurgery(surgeryId)

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Workflow Engine
              </h1>
              <p className="text-gray-600">
                {surgery.name}
              </p>
            </div>
            <Link
              href={`/s/${surgeryId}/workflow/start`}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Start New Workflow
            </Link>
          </div>

          <div className="space-y-6">
            {/* Admin Section */}
            {isAdmin && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Workflow Management
                </h2>
                
                <div className="space-y-2">
                  <Link
                    href={`/s/${surgeryId}/workflow/templates`}
                    className="block text-blue-600 hover:text-blue-800 underline"
                  >
                    Manage Templates
                  </Link>
                </div>
              </div>
            )}

            {/* Recent Instances */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Recent Workflows
                </h2>
              </div>
              {instances.length === 0 ? (
                <div className="px-6 py-4 text-center text-sm text-gray-500">
                  No workflows started yet. <Link href={`/s/${surgeryId}/workflow/start`} className="text-blue-600 underline">Start one</Link> to get started.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Template
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reference
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Started By
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Started
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {instances.map((instance) => (
                      <tr key={instance.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {instance.template.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {instance.reference || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            instance.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-800'
                              : instance.status === 'CANCELLED'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {instance.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {instance.startedBy.name || instance.startedBy.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {instance.createdAt.toLocaleDateString()} {instance.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/s/${surgeryId}/workflow/instances/${instance.id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            {instance.status === 'ACTIVE' ? 'Resume' : 'View'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('[WorkflowDashboard] Error:', error)
    redirect('/unauthorized')
  }
}

