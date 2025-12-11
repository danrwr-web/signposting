import 'server-only'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { createWorkflowTemplate } from '../actions'

interface WorkflowTemplatesPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function WorkflowTemplatesPage({ params }: WorkflowTemplatesPageProps) {
  const { id: surgeryId } = await params

  try {
    const user = await requireSurgeryAdmin(surgeryId)

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

    // Get workflow templates for this surgery
    let templates
    try {
      templates = await prisma.workflowTemplate.findMany({
        where: {
          surgeryId: surgeryId
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          createdAt: true,
        }
      })
    } catch (error) {
      console.error('Error fetching workflow templates:', error)
      // If tables don't exist yet, return empty array instead of crashing
      if (error instanceof Error && error.message.includes('does not exist')) {
        templates = []
      } else {
        throw error
      }
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 flex justify-between items-start">
            <div>
              <Link
                href={`/s/${surgeryId}/workflow`}
                className="text-blue-600 hover:text-blue-800 underline mb-2 inline-block"
              >
                    ← Back to Workflow Guidance
              </Link>
                  <h1 className="text-2xl font-bold text-gray-900 mt-2">
                    Manage Workflow Templates
                  </h1>
              <p className="text-gray-600">
                {surgery.name}
              </p>
            </div>
            <form action={createWorkflowTemplate.bind(null, surgeryId)}>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                New workflow template
              </button>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {templates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      No workflow templates found
                    </td>
                  </tr>
                ) : (
                  templates.map((template) => (
                    <tr key={template.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {template.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {template.description || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          template.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {template.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {template.createdAt.toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/s/${surgeryId}/workflow/templates/${template.id}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}

