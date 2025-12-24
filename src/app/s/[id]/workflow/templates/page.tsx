import 'server-only'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import TemplatesClient from './TemplatesClient'

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
          workflowType: true,
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
          <TemplatesClient surgeryId={surgeryId} templates={templates} />
        </div>
      </div>
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}

