import 'server-only'

import { requireSurgeryAccess, can } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import WorkflowEngagementClient from './WorkflowEngagementClient'

interface WorkflowEngagementPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function WorkflowEngagementPage({ params }: WorkflowEngagementPageProps) {
  const { id: surgeryId } = await params

  try {
    const user = await requireSurgeryAccess(surgeryId)

    // Check admin access
    if (!can(user).isAdminOfSurgery(surgeryId)) {
      redirect('/unauthorized')
    }

    // Get surgery details
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: {
        id: true,
        name: true,
      },
    })

    if (!surgery) {
      redirect('/unauthorized')
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back link */}
          <div className="mb-6">
            <Link
              href={`/s/${surgeryId}/workflow`}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Workflow Guidance
            </Link>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-gray-900 mb-1 tracking-tight">
              Engagement
            </h1>
            <p className="text-sm text-gray-500 mb-3">
              Workflow Guidance • {surgery.name}
            </p>
            <p className="text-base text-gray-600 leading-relaxed">
              See how workflows are being used across your surgery. This helps identify which guidance is most helpful to staff.
            </p>
          </div>

          <WorkflowEngagementClient surgeryId={surgeryId} />
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error loading workflow engagement page:', error)
    redirect('/unauthorized')
  }
}
