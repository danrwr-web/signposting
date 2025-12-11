import 'server-only'
import { requireSurgeryAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import WorkflowDiagramClient from '@/components/workflow/WorkflowDiagramClient'

interface WorkflowTemplateViewPageProps {
  params: Promise<{
    id: string
    templateId: string
  }>
}

export default async function WorkflowTemplateViewPage({ params }: WorkflowTemplateViewPageProps) {
  const { id: surgeryId, templateId } = await params

  try {
    await requireSurgeryAccess(surgeryId)

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

    // Get workflow template with nodes and answer options
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        id: templateId,
        surgeryId: surgeryId
      },
      include: {
        nodes: {
          orderBy: {
            sortOrder: 'asc'
          },
          include: {
            answerOptions: {
              orderBy: {
                label: 'asc'
              },
              select: {
                id: true,
                label: true,
                nextNodeId: true,
                actionKey: true,
              }
            }
          },
          select: {
            id: true,
            nodeType: true,
            title: true,
            body: true,
            sortOrder: true,
            positionX: true,
            positionY: true,
            actionKey: true,
            answerOptions: true,
          }
        }
      }
    })

    if (!template) {
      redirect('/unauthorized')
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <Link
              href={`/s/${surgeryId}/workflow/templates/${templateId}`}
              className="text-blue-600 hover:text-blue-800 underline mb-2 inline-block"
            >
              ← Back to Edit Template
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">
              Workflow Diagram: {template.name}
            </h1>
            <p className="text-gray-600">
              {surgery.name}
            </p>
            {template.description && (
              <p className="text-gray-600 mt-2">
                {template.description}
              </p>
            )}
          </div>

          <WorkflowDiagramClient
            template={template}
          />
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error loading workflow template view:', error)
    redirect('/unauthorized')
  }
}

