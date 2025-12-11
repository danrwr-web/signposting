import 'server-only'
import { requireSurgeryAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  continueFromInstructionNode,
  answerQuestionNode,
} from '../../actions'
import WorkflowRunnerClient from './WorkflowRunnerClient'

interface WorkflowInstancePageProps {
  params: Promise<{
    id: string
    instanceId: string
  }>
}

export default async function WorkflowInstancePage({ params }: WorkflowInstancePageProps) {
  const { id: surgeryId, instanceId } = await params

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

    // Get workflow instance with template and current node
    const instance = await prisma.workflowInstance.findFirst({
      where: {
        id: instanceId,
        surgeryId,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            description: true,
          }
        },
        startedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        answers: {
          include: {
            nodeTemplate: {
              select: {
                id: true,
                title: true,
              }
            },
            answerOption: {
              select: {
                id: true,
                label: true,
                valueKey: true,
              }
            }
          },
          orderBy: {
            createdAt: 'asc',
          }
        }
      }
    })

    if (!instance) {
      redirect('/unauthorized')
    }

    // If completed, show completion summary
    if (instance.status === 'COMPLETED') {
      // Find the last answer to get the action key
      const lastAnswer = instance.answers[instance.answers.length - 1]
      let finalActionKey: string | null = null
      
      if (lastAnswer?.answerOption?.id) {
        // Get action key from the answer option
        const option = await prisma.workflowAnswerOptionTemplate.findUnique({
          where: { id: lastAnswer.answerOption.id },
          select: { actionKey: true }
        })
        finalActionKey = option?.actionKey || null
      }

      return (
        <WorkflowRunnerClient
          surgeryId={surgeryId}
          surgeryName={surgery.name}
          instance={instance}
          currentNode={null}
          continueAction={continueFromInstructionNode.bind(null, surgeryId, instanceId)}
          answerAction={answerQuestionNode.bind(null, surgeryId, instanceId)}
          completed={true}
          finalActionKey={finalActionKey}
        />
      )
    }

    // Get current node with answer options
    let currentNode = null
    if (instance.currentNodeId) {
      currentNode = await prisma.workflowNodeTemplate.findUnique({
        where: { id: instance.currentNodeId },
        include: {
          answerOptions: {
            orderBy: {
              label: 'asc',
            }
          }
        }
      })
    }

    if (!currentNode) {
      // No current node - mark as completed
      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        }
      })
      redirect(`/s/${surgeryId}/workflow/instances/${instanceId}`)
    }

    // Handle END node - mark as completed if not already
    if (currentNode.nodeType === 'END') {
      if (instance.status !== 'COMPLETED') {
        await prisma.workflowInstance.update({
          where: { id: instanceId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          }
        })
      }
    }

    return (
      <WorkflowRunnerClient
        surgeryId={surgeryId}
        surgeryName={surgery.name}
        instance={instance}
        currentNode={currentNode}
        continueAction={continueFromInstructionNode.bind(null, surgeryId, instanceId)}
        answerAction={answerQuestionNode.bind(null, surgeryId, instanceId)}
        completed={false}
        finalActionKey={currentNode.nodeType === 'END' ? currentNode.actionKey : null}
      />
    )
  } catch (error) {
    console.error('Error loading workflow instance:', error)
    redirect('/unauthorized')
  }
}

