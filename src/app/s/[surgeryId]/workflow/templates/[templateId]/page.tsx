import 'server-only'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import {
  updateWorkflowTemplate,
  createWorkflowNode,
  updateWorkflowNodeWrapper,
  deleteWorkflowNode,
  createWorkflowAnswerOptionWrapper,
  updateWorkflowAnswerOptionWrapper,
  deleteWorkflowAnswerOption,
} from '../../actions'
import { WorkflowNodeType, WorkflowActionKey } from '@prisma/client'
import TemplateEditClient from './TemplateEditClient'

interface WorkflowTemplateEditPageProps {
  params: Promise<{
    surgeryId: string
    templateId: string
  }>
  searchParams: Promise<{
    error?: string
    success?: string
  }>
}

export default async function WorkflowTemplateEditPage({ params, searchParams }: WorkflowTemplateEditPageProps) {
  const { surgeryId, templateId } = await params
  const { error, success } = await searchParams

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

    // Get workflow template with nodes and answer options
    let template
    try {
      template = await prisma.workflowTemplate.findFirst({
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
                }
              }
            }
          }
        }
      })
    } catch (error) {
      console.error('Error fetching workflow template:', error)
      // If tables don't exist yet, redirect to templates list
      if (error instanceof Error && error.message.includes('does not exist')) {
        redirect(`/s/${surgeryId}/workflow/templates?error=migration_required`)
      } else {
        throw error
      }
    }

    if (!template) {
      redirect('/unauthorized')
    }

    return (
      <TemplateEditClient
        surgeryId={surgeryId}
        templateId={templateId}
        surgeryName={surgery.name}
        template={template}
        updateTemplateAction={updateWorkflowTemplate.bind(null, surgeryId, templateId)}
        createNodeAction={createWorkflowNode.bind(null, surgeryId, templateId)}
        updateNodeAction={updateWorkflowNodeWrapper.bind(null, surgeryId, templateId)}
        deleteNodeAction={deleteWorkflowNode.bind(null, surgeryId, templateId)}
        createAnswerOptionAction={createWorkflowAnswerOptionWrapper.bind(null, surgeryId, templateId)}
        updateAnswerOptionAction={updateWorkflowAnswerOptionWrapper.bind(null, surgeryId, templateId)}
        deleteAnswerOptionAction={deleteWorkflowAnswerOption.bind(null, surgeryId, templateId)}
        initialError={error}
        initialSuccess={success}
      />
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}
