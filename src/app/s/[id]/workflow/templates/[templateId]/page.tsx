import 'server-only'
import { requireSuperuserOrSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { updateWorkflowTemplate } from '../../actions'
import TemplateEditClient from './TemplateEditClient'

const GLOBAL_SURGERY_ID = 'global-default-buttons'

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
    const user = await requireSuperuserOrSurgeryAdmin(surgeryId)

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
          iconKey: true,
          colourHex: true,
          isActive: true,
          workflowType: true,
          approvalStatus: true,
          approvedBy: true,
          approvedAt: true,
          lastEditedBy: true,
          lastEditedAt: true,
          sourceTemplateId: true,
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

    // If a SUPERUSER is trying to edit a Global Default template while in another surgery context,
    // redirect them to the Global Default surgery route so all server actions validate correctly.
    if (!template) {
      if (user.globalRole === 'SUPERUSER' && surgeryId !== GLOBAL_SURGERY_ID) {
        const globalExists = await prisma.workflowTemplate.findFirst({
          where: { id: templateId, surgeryId: GLOBAL_SURGERY_ID },
          select: { id: true },
        })

        if (globalExists) {
          const qs = new URLSearchParams()
          if (error) qs.set('error', error)
          if (success) qs.set('success', success)
          const suffix = qs.toString() ? `?${qs.toString()}` : ''
          redirect(`/s/${GLOBAL_SURGERY_ID}/workflow/templates/${templateId}${suffix}`)
        }
      }

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
