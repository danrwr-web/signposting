import 'server-only'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { updateWorkflowTemplate } from '../../actions'
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

    // Get workflow template
    let template
    try {
      template = await prisma.workflowTemplate.findFirst({
        where: {
          id: templateId,
          surgeryId: surgeryId
        },
        select: {
          id: true,
          name: true,
          description: true,
          colourHex: true,
          isActive: true,
          workflowType: true,
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

    // Create bound server action using .bind() to preserve 'use server' marking
    const updateTemplateAction = updateWorkflowTemplate.bind(null, surgeryId, templateId)

    return (
      <TemplateEditClient
        surgeryId={surgeryId}
        templateId={templateId}
        surgeryName={surgery.name}
        template={template}
        updateTemplateAction={updateTemplateAction}
        initialError={error}
        initialSuccess={success}
      />
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}
