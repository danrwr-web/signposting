import 'server-only'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

interface WorkflowDashboardPageProps {
  params: Promise<{
    surgeryId: string
  }>
}

export default async function WorkflowDashboardPage({ params }: WorkflowDashboardPageProps) {
  const { surgeryId } = await params

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

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Workflow Engine
          </h1>
          <p className="text-gray-600 mb-8">
            {surgery.name}
          </p>

          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Workflow Management
              </h2>
              
              <div className="space-y-2">
                <Link
                  href={`/s/${surgeryId}/workflow/templates`}
                  className="block text-blue-600 hover:text-blue-800 underline"
                >
                  View Templates
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}

