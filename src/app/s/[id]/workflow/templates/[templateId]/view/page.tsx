import 'server-only'

export const dynamic = 'force-dynamic'
export const revalidate = 0
import { requireSurgeryAccess, can } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import Link from 'next/link'
import WorkflowDiagramClientWrapper from '@/components/workflow/WorkflowDiagramClientWrapper'
import SimpleHeader from '@/components/SimpleHeader'
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
  approveWorkflowTemplate,
} from '../../../actions'

const GLOBAL_SURGERY_ID = 'global-default-buttons'

// Type for the Prisma query result with all includes
type WorkflowTemplateQueryResult = NonNullable<Awaited<ReturnType<typeof prisma.workflowTemplate.findFirst<{
  include: {
    nodes: {
      include: {
        answerOptions: true
        workflowLinks: {
          include: {
            template: {
              select: {
                id: true
                name: true
              }
            }
          }
        }
      }
    }
    styleDefaults: true
  }
}>>>>

// Type for the component (with badges as string[] instead of Json)
type WorkflowTemplateForComponent = Omit<WorkflowTemplateQueryResult, 'nodes'> & {
  nodes: Array<Omit<WorkflowTemplateQueryResult['nodes'][number], 'badges'> & {
    badges: string[]
  }>
}

function buildNodeMatchKey(node: { sortOrder: number; nodeType: unknown; title: string }): string {
  return `${node.sortOrder}::${String(node.nodeType)}::${node.title.trim()}`
}

function repairOverrideAnswerOptionLinks(
  overrideTemplate: WorkflowTemplateQueryResult,
  sourceTemplate: WorkflowTemplateQueryResult,
): WorkflowTemplateQueryResult {
  // Only repair when shapes look as expected
  if (!overrideTemplate.nodes?.length || !sourceTemplate.nodes?.length) return overrideTemplate

  const overrideByKey = new Map<string, string>()
  for (const n of overrideTemplate.nodes) {
    overrideByKey.set(buildNodeMatchKey(n), n.id)
  }

  const sourceByKey = new Map<string, WorkflowTemplateQueryResult['nodes'][number]>()
  for (const n of sourceTemplate.nodes) {
    sourceByKey.set(buildNodeMatchKey(n), n)
  }

  const sourceNodeIdToOverrideNodeId = new Map<string, string>()
  for (const sourceNode of sourceTemplate.nodes) {
    const key = buildNodeMatchKey(sourceNode)
    const overrideNodeId = overrideByKey.get(key)
    if (overrideNodeId) {
      sourceNodeIdToOverrideNodeId.set(sourceNode.id, overrideNodeId)
    }
  }

  // Repair only missing nextNodeId where the source has a nextNodeId.
  const repairedNodes = overrideTemplate.nodes.map((overrideNode: WorkflowTemplateQueryResult['nodes'][number]) => {
    const sourceNode = sourceByKey.get(buildNodeMatchKey(overrideNode))
    if (!sourceNode) return overrideNode

    const sourceOptionByValueKey = new Map<string, WorkflowTemplateQueryResult['nodes'][number]['answerOptions'][number]>()
    for (const opt of sourceNode.answerOptions) {
      sourceOptionByValueKey.set(opt.valueKey, opt)
    }

    const repairedOptions = overrideNode.answerOptions.map((overrideOpt: WorkflowTemplateQueryResult['nodes'][number]['answerOptions'][number]) => {
      if (overrideOpt.nextNodeId) return overrideOpt

      const sourceOpt = sourceOptionByValueKey.get(overrideOpt.valueKey)
      if (!sourceOpt?.nextNodeId) return overrideOpt

      const mappedNext = sourceNodeIdToOverrideNodeId.get(sourceOpt.nextNodeId) ?? null
      if (!mappedNext) return overrideOpt

      return { ...overrideOpt, nextNodeId: mappedNext }
    })

    return { ...overrideNode, answerOptions: repairedOptions }
  })

  return { ...overrideTemplate, nodes: repairedNodes }
}

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

    // Get surgery details and all surgeries for header
    const [surgery, surgeries] = await Promise.all([
      prisma.surgery.findUnique({
        where: { id: surgeryId },
        select: {
          id: true,
          name: true,
        }
      }),
      prisma.surgery.findMany({
        orderBy: { name: 'asc' }
      })
    ])

    if (!surgery) {
      redirect('/unauthorized')
    }

    // Resolve template from either the current surgery or the Global Default surgery.
    // This allows surgeries to view inherited "Global Default" workflows without copying them.
    const templateOwnerSurgeryId = await (async () => {
      const local = await prisma.workflowTemplate.findFirst({
        where: {
          id: templateId,
          surgeryId,
        },
        select: { id: true },
      })
      return local ? surgeryId : GLOBAL_SURGERY_ID
    })()

    const template = await prisma.workflowTemplate.findFirst({
      where: {
        id: templateId,
        surgeryId: templateOwnerSurgeryId,
      },
      include: {
        nodes: {
          orderBy: {
            sortOrder: 'asc',
          },
          include: {
            answerOptions: {
              orderBy: {
                label: 'asc',
              },
              select: {
                id: true,
                label: true,
                valueKey: true,
                nextNodeId: true,
                actionKey: true,
                sourceHandle: true,
                targetHandle: true,
              },
            },
            workflowLinks: {
              orderBy: {
                sortOrder: 'asc',
              },
              include: {
                template: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        styleDefaults: true,
      },
    })

    // Get surgery-level style defaults
    const surgeryDefaults = await prisma.workflowNodeStyleDefaultSurgery.findMany({
      where: { surgeryId: templateOwnerSurgeryId },
      select: {
        nodeType: true,
        bgColor: true,
        textColor: true,
        borderColor: true,
      },
    })

    if (!template) {
      redirect('/unauthorized')
    }

    let templateForRender = template

    // If viewing a surgery-owned override, repair any missing nextNodeId mappings from the source Global Default template.
    // This is non-destructive: it only affects what we render, and avoids silent loss of edges after migrations.
    if (templateOwnerSurgeryId === surgeryId && template.sourceTemplateId) {
      const sourceTemplate = await prisma.workflowTemplate.findFirst({
        where: {
          id: template.sourceTemplateId,
          surgeryId: GLOBAL_SURGERY_ID,
        },
        include: {
          nodes: {
            orderBy: {
              sortOrder: 'asc',
            },
            include: {
              answerOptions: true,
              workflowLinks: {
                include: {
                  template: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          styleDefaults: true,
        },
      })

      if (sourceTemplate) {
        templateForRender = repairOverrideAnswerOptionLinks(template, sourceTemplate)
      }
    }

    // Check if user can admin *this template* (global templates should only be editable by superusers).
    const isAdmin = can(user).isAdminOfSurgery(templateOwnerSurgeryId)
    const isSuperuser = user.globalRole === 'SUPERUSER'

    // Staff (and non-global admins) must not see draft templates.
    if (!isAdmin && templateForRender.approvalStatus !== 'APPROVED') {
      redirect('/unauthorized')
    }

    // Get all active templates for the template owner surgery (for linked workflow dropdown)
    const allTemplates = isAdmin ? await prisma.workflowTemplate.findMany({
      where: {
        surgeryId: templateOwnerSurgeryId,
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

    const answerOptionsWithNextCount = templateForRender.nodes.reduce((count, node) => {
      return count + node.answerOptions.filter((option) => option.nextNodeId !== null).length
    }, 0)
    const showDebugCounts = process.env.NODE_ENV !== 'production'
    const nodeCount = templateForRender.nodes.length
    const missingTargetCount = templateForRender.nodes.reduce((acc, node) => {
      const ids = new Set(templateForRender.nodes.map((n) => n.id))
      return acc + node.answerOptions.filter((opt) => opt.nextNodeId && !ids.has(opt.nextNodeId)).length
    }, 0)

    if (showDebugCounts) {
      console.info('[WorkflowDiagram] Loaded template', {
        surgeryId,
        templateId,
        templateOwnerSurgeryId,
        nodeCount,
        answerOptionsWithNextCount,
        missingTargetCount,
      })
    }

    // Create bound server actions for admin editing
    const updatePositionAction = isAdmin ? updateWorkflowNodePosition.bind(null, surgeryId, templateId) : undefined
    const createNodeAction = isAdmin ? createWorkflowNodeForTemplate.bind(null, surgeryId, templateId) : undefined
    const createAnswerOptionAction = isAdmin ? createWorkflowAnswerOptionForDiagram.bind(null, surgeryId, templateId) : undefined
    const updateAnswerOptionLabelAction = isAdmin ? updateWorkflowAnswerOptionLabel.bind(null, surgeryId, templateId) : undefined
    const deleteAnswerOptionAction = isAdmin ? deleteWorkflowAnswerOptionById.bind(null, surgeryId, templateId) : undefined
    const deleteNodeAction = isAdmin ? deleteWorkflowNodeById.bind(null, surgeryId, templateId) : undefined
    const updateNodeAction = isAdmin ? updateWorkflowNodeForDiagram.bind(null, surgeryId, templateId) : undefined
    const publishWorkflowAction = isAdmin
      ? approveWorkflowTemplate.bind(null, templateOwnerSurgeryId, templateId)
      : undefined

    return (
      <div className="min-h-screen bg-gray-50 w-full">
        <SimpleHeader surgeries={surgeries} currentSurgeryId={surgeryId} />
        
        <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 py-8">
          {/* Back link and content header */}
          <div className="mb-8">
            {/* Back link */}
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

          <div className="w-full min-w-0">
            <WorkflowDiagramClientWrapper
              template={{
                ...templateForRender,
                nodes: templateForRender.nodes.map((node) => {
                  // Safely convert Prisma Json to string[]
                  let badges: string[] = []
                  if (node.badges) {
                    if (Array.isArray(node.badges)) {
                      badges = node.badges as string[]
                    } else if (typeof node.badges === 'string') {
                      try {
                        badges = JSON.parse(node.badges) as string[]
                      } catch {
                        badges = []
                      }
                    }
                  }
                  // Safely convert Prisma Json to style object
                  let style: {
                    bgColor?: string
                    textColor?: string
                    borderColor?: string
                    borderWidth?: number
                    radius?: number
                    fontWeight?: 'normal' | 'medium' | 'bold'
                    theme?: 'default' | 'info' | 'warning' | 'success' | 'muted' | 'panel'
                    width?: number
                    height?: number
                  } | null = null
                  if (node.style) {
                    if (typeof node.style === 'object' && node.style !== null && !Array.isArray(node.style)) {
                      style = node.style as unknown as typeof style
                    } else if (typeof node.style === 'string') {
                      try {
                        style = JSON.parse(node.style) as typeof style
                      } catch {
                        style = null
                      }
                    }
                  }
                  return {
                    ...node,
                    badges,
                    style,
                  }
                }),
                styleDefaults: templateForRender.styleDefaults.map((default_) => ({
                  nodeType: default_.nodeType,
                  bgColor: default_.bgColor,
                  textColor: default_.textColor,
                  borderColor: default_.borderColor,
                })),
              } as Parameters<typeof WorkflowDiagramClientWrapper>[0]['template']}
              isAdmin={isAdmin}
              isSuperuser={isSuperuser}
              allTemplates={allTemplates}
              surgeryId={surgeryId}
              templateId={templateId}
              publishWorkflowAction={publishWorkflowAction}
              surgeryDefaults={surgeryDefaults}
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
      </div>
    )
  } catch (error) {
    console.error('Error loading workflow template view:', error)
    redirect('/unauthorized')
  }
}

