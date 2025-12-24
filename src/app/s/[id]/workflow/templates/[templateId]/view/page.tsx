import 'server-only'

export const dynamic = 'force-dynamic'
export const revalidate = 0
import { requireSurgeryAccess, can } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import WorkflowDiagramClientWrapper from '@/components/workflow/WorkflowDiagramClientWrapper'
import {
  updateWorkflowNodePosition,
  createWorkflowNodeForTemplate,
  createWorkflowAnswerOptionForDiagram,
  updateWorkflowAnswerOptionLabel,
  deleteWorkflowAnswerOptionById,
  deleteWorkflowNodeById,
  updateWorkflowNodeForDiagram,
  createWorkflowNodeLink,
  deleteWorkflowNodeLink,
  bulkUpdateWorkflowNodePositions,
} from '../../../actions'

interface WorkflowTemplateViewPageProps {
  params: {
    id: string
    templateId: string
  }
}

export default async function WorkflowTemplateViewPage({ params }: WorkflowTemplateViewPageProps) {
  const { id: surgeryId, templateId } = params

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

    const answerOptionsWithNextCount = template.nodes.reduce((count, node) => {
      return count + node.answerOptions.filter((option) => option.nextNodeId !== null).length
    }, 0)
    const showDebugCounts = process.env.NODE_ENV !== 'production'

    // Create bound server actions for admin editing
    const updatePositionAction = isAdmin ? updateWorkflowNodePosition.bind(null, surgeryId, templateId) : undefined
    const createNodeAction = isAdmin ? createWorkflowNodeForTemplate.bind(null, surgeryId, templateId) : undefined
    const createAnswerOptionAction = isAdmin ? createWorkflowAnswerOptionForDiagram.bind(null, surgeryId, templateId) : undefined
    const updateAnswerOptionLabelAction = isAdmin ? updateWorkflowAnswerOptionLabel.bind(null, surgeryId, templateId) : undefined
    const deleteAnswerOptionAction = isAdmin ? deleteWorkflowAnswerOptionById.bind(null, surgeryId, templateId) : undefined
    const deleteNodeAction = isAdmin ? deleteWorkflowNodeById.bind(null, surgeryId, templateId) : undefined
    const updateNodeAction = isAdmin ? updateWorkflowNodeForDiagram.bind(null, surgeryId, templateId) : undefined

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header - Visually grouped */}
          <div className="mb-8">
            {/* Quiet context */}
            <div className="mb-4">
              <Link
                href={`/s/${surgeryId}/workflow`}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors inline-flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Workflow Guidance
              </Link>
              <span className="text-sm text-gray-400 mx-2">·</span>
              <span className="text-sm text-gray-500">{surgery.name}</span>
            </div>
            
            {/* Strong workflow title + description */}
            <div className="mb-6">
              <h1 className="text-3xl font-semibold text-gray-900 mb-2 tracking-tight">
                {template.name}
              </h1>
              {template.description && (
                <p className="text-base text-gray-600 leading-relaxed max-w-3xl">
                  {template.description}
                </p>
              )}
            </div>
            
            {showDebugCounts && (
              <p className="text-xs text-gray-400 mt-2">
                Debug: nodes {template.nodes.length} · connections {answerOptionsWithNextCount}
              </p>
            )}
          </div>

          <WorkflowDiagramClientWrapper
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

