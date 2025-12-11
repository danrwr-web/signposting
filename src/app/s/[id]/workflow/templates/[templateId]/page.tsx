import 'server-only'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import {
  updateWorkflowTemplate,
  createWorkflowNode,
  updateWorkflowNode,
  deleteWorkflowNode,
  createWorkflowAnswerOption,
  updateWorkflowAnswerOption,
  deleteWorkflowAnswerOption,
} from '../../actions'
import { WorkflowNodeType, WorkflowActionKey } from '@prisma/client'
import TemplateEditClient from './TemplateEditClient'

interface WorkflowTemplateEditPageProps {
  params: Promise<{
    id: string
    templateId: string
  }>
  searchParams: Promise<{
    error?: string
    success?: string
  }>
}

export default async function WorkflowTemplateEditPage({ params, searchParams }: WorkflowTemplateEditPageProps) {
  const { id: surgeryId, templateId } = await params
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

    // Create bound server actions using .bind() to preserve 'use server' marking
    const updateTemplateAction = updateWorkflowTemplate.bind(null, surgeryId, templateId)
    const createNodeAction = createWorkflowNode.bind(null, surgeryId, templateId)
    const updateNodeAction = updateWorkflowNode.bind(null, surgeryId, templateId)
    const deleteNodeAction = deleteWorkflowNode.bind(null, surgeryId, templateId)
    const createAnswerOptionAction = createWorkflowAnswerOption.bind(null, surgeryId, templateId)
    const updateAnswerOptionAction = updateWorkflowAnswerOption.bind(null, surgeryId, templateId)
    const deleteAnswerOptionAction = deleteWorkflowAnswerOption.bind(null, surgeryId, templateId)

    return (
      <TemplateEditClient
        surgeryId={surgeryId}
        templateId={templateId}
        surgeryName={surgery.name}
        template={template}
        updateTemplateAction={updateTemplateAction}
        createNodeAction={createNodeAction}
        updateNodeAction={updateNodeAction}
        deleteNodeAction={deleteNodeAction}
        createAnswerOptionAction={createAnswerOptionAction}
        updateAnswerOptionAction={updateAnswerOptionAction}
        deleteAnswerOptionAction={deleteAnswerOptionAction}
        initialError={error}
        initialSuccess={success}
      />
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}
