import 'server-only'

export const dynamic = 'force-dynamic'
export const revalidate = 0
import { requireSurgeryAccess, can } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import WorkflowDiagramClient from '@/components/workflow/WorkflowDiagramClient'
import {
  updateWorkflowNodePosition,
  createWorkflowNodeForTemplate,
  createWorkflowAnswerOptionForDiagram,
  updateWorkflowAnswerOptionLabel,
  deleteWorkflowAnswerOptionById,
  deleteWorkflowNodeById,
  updateWorkflowNodeForDiagram,
} from '../../../actions'

interface WorkflowTemplateViewPageProps {
  params: Promise<{
    id: string
    templateId: string
  }>
}

export default async function WorkflowTemplateViewPage({ params }: WorkflowTemplateViewPageProps) {
  const { id: surgeryId, templateId } = await params

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
                sourceHandle: true,
                targetHandle: true,
              }
            },
            workflowLinks: {
              orderBy: {
                sortOrder: 'asc'
              },
              include: {
                template: {
                  select: {
                    id: true,
                    name: true,
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!template) {
      redirect('/unauthorized')
    }

    // Check if user is admin
    const isAdmin = can(user).isAdminOfSurgery(surgeryId)

    // Get all active templates for the surgery (for linked workflow dropdown)
    const allTemplates = isAdmin ? await prisma.workflowTemplate.findMany({
      where: {
        surgeryId: surgeryId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      }
    }) : []

    // Create bound server actions for admin editing
    const updatePositionAction = isAdmin ? updateWorkflowNodePosition.bind(null, surgeryId, templateId) : undefined
    const createNodeAction = isAdmin ? createWorkflowNodeForTemplate.bind(null, surgeryId, templateId) : undefined
    const createAnswerOptionAction = isAdmin ? createWorkflowAnswerOptionForDiagram.bind(null, surgeryId, templateId) : undefined
    const updateAnswerOptionLabelAction = isAdmin ? updateWorkflowAnswerOptionLabel.bind(null, surgeryId, templateId) : undefined
    const deleteAnswerOptionAction = isAdmin ? deleteWorkflowAnswerOptionById.bind(null, surgeryId, templateId) : undefined
    const deleteNodeAction = isAdmin ? deleteWorkflowNodeById.bind(null, surgeryId, templateId) : undefined
    const updateNodeAction = isAdmin ? updateWorkflowNodeForDiagram.bind(null, surgeryId, templateId) : undefined
    const createWorkflowLinkAction = isAdmin ? createWorkflowNodeLink.bind(null, surgeryId, templateId) : undefined
    const deleteWorkflowLinkAction = isAdmin ? deleteWorkflowNodeLink.bind(null, surgeryId, templateId) : undefined

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <Link
              href={`/s/${surgeryId}/workflow`}
              className="text-blue-600 hover:text-blue-800 underline mb-2 inline-block"
            >
              ← Back to Workflow Guidance
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">
              Visual guidance for handling: {template.name}
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
            isAdmin={isAdmin}
            allTemplates={allTemplates}
            surgeryId={surgeryId}
            updatePositionAction={updatePositionAction}
            createNodeAction={createNodeAction}
            createAnswerOptionAction={createAnswerOptionAction}
            updateAnswerOptionLabelAction={updateAnswerOptionLabelAction}
            deleteAnswerOptionAction={deleteAnswerOptionAction}
            deleteNodeAction={deleteNodeAction}
            updateNodeAction={updateNodeAction}
          />
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error loading workflow template view:', error)
    redirect('/unauthorized')
  }
}

